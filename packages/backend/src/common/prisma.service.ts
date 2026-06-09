import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantContextStorage } from './tenant-context';
import { EventBusService } from './event-bus.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly _extended: any;

  constructor(private eventBus: EventBusService) {
    super();
    
    const self = this;
    
    /**
     * AI MANDATE: Deterministic Tenant Isolation (Phase 1 Hardening)
     * This extension intercepts all operations and programmatically injects 
     * tenantId into every query, preventing cross-tenant data leaks.
     */
    this._extended = this.$extends({
      query: {
        async $queryRaw({ args, query }) {
          const tenantId = tenantContextStorage.getStore()?.tenantId;
          if (!tenantId) {
            throw new Error('CRITICAL SECURITY FAILURE: Raw query attempted without tenant context.');
          }
          return query(args);
        },
        async $executeRaw({ args, query }) {
          const tenantId = tenantContextStorage.getStore()?.tenantId;
          if (!tenantId) {
            throw new Error('CRITICAL SECURITY FAILURE: Raw execution attempted without tenant context.');
          }
          return query(args);
        },
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            // Models that should NOT have tenantId injected (global models)
            // Normalize to PascalCase for consistent matching
            const modelName = model ? model.charAt(0).toUpperCase() + model.slice(1) : '';
            const excludedModels = ['Tenant', 'Role'];
            
            if (excludedModels.includes(modelName)) {
              return query(args);
            }

            const context = tenantContextStorage.getStore();
            const tenantId = context?.tenantId;

            if (!tenantId) {
              throw new Error(`CRITICAL SECURITY FAILURE: Operation on ${modelName} attempted without tenant context.`);
            }

            const a = args as any;
            
            // 1. Handle filters (where)
            if (['findMany', 'findFirst', 'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany'].includes(operation)) {
              a.where = { ...a.where, tenantId };
            } 
            // 2. Handle unique lookups - Convert findUnique to findFirst to allow tenant filtering
            // since tenantId is not the primary key.
            else if (operation === 'findUnique') {
              const delegateName = model ? model.charAt(0).toLowerCase() + model.slice(1) : '';
              return (self as any)[delegateName].findFirst({
                ...a,
                where: { ...a.where, tenantId }
              });
            }
            // 3. Handle single record mutations
            else if (['update', 'delete'].includes(operation)) {
              a.where = { ...a.where, tenantId };
            }
            // 4. Handle creation
            else if (operation === 'create') {
              // Remove tenantId if it exists and tenant relation is also present to avoid Prisma conflict
              if (a.data.tenant && a.data.tenantId) {
                delete a.data.tenantId;
              }
              
              // Only inject if not already present to avoid conflict
              if (!a.data.tenantId && !a.data.tenant) {
                a.data.tenant = { connect: { id: tenantId } };
              }
            } else if (operation === 'createMany') {
              if (Array.isArray(a.data)) {
                a.data = a.data.map((item: any) => ({ 
                  ...item, 
                  tenantId: item.tenantId || tenantId 
                }));
              }
            } else if (operation === 'upsert') {
              a.where = { ...a.where, tenantId };
              
              // Cleanup create
              if (a.create.tenant && a.create.tenantId) {
                delete a.create.tenantId;
              }
              if (!a.create.tenantId && !a.create.tenant) {
                a.create.tenant = { connect: { id: tenantId } };
              }
              
              // Cleanup update
              a.update = { ...a.update, tenantId };
            }

            const result = await query(args);

            // Webhook Event Trigger
            if (tenantId && model && ['create', 'update', 'delete', 'upsert'].includes(operation)) {
              // Convert model name to UPPER_SNAKE_CASE for event naming (e.g., User -> USER_CREATED)
              const entityName = model.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
              let eventType = '';
              if (operation === 'create') eventType = `${entityName}_CREATED`;
              else if (operation === 'update') eventType = `${entityName}_UPDATED`;
              else if (operation === 'delete') eventType = `${entityName}_DELETED`;
              else if (operation === 'upsert') eventType = `${entityName}_UPSERTED`;

              eventBus.emitModelEvent({
                model,
                operation: eventType,
                data: result,
                tenantId,
              });
            }

            return result;
          },
        },
      },
    });

    /**
     * MASTERPIECE PROXY PATTERN
     * Ensures we can use PrismaService as a normal class while delegating 
     * all model operations to the extended client.
     */
    return new Proxy(this, {
      get(target, prop, receiver) {
        // 1. If the property exists directly on PrismaService instance (like $connect), use it.
        // We use Reflect.has but exclude model names which might exist on base target too.
        if (prop === '$connect' || prop === '$disconnect' || prop === 'onModuleInit' || prop === 'onModuleDestroy') {
          return Reflect.get(target, prop, receiver);
        }
        
        // 2. Delegate everything else (models, raw queries, transactions) to extended client
        return Reflect.get(target._extended, prop, receiver);
      }
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
