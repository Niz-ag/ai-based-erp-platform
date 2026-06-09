import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { tenantContextStorage } from '../common/tenant-context';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  private async getEmployee(email: string, tenantId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        email: email,
        tenantId: tenantId,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee record not found for the current user');
    }

    return employee;
  }

  async clockIn(currentUser: CurrentUserData) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant context missing');

    const employee = await this.getEmployee(currentUser.email, tenantId);

    // Check if already clocked in
    const activeAttendance = await this.prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        tenantId: tenantId,
        checkOut: null,
      },
    });

    if (activeAttendance) {
      throw new BadRequestException('Already clocked in');
    }

    return this.prisma.attendance.create({
      data: {
        employeeId: employee.id,
        tenantId: tenantId,
        checkIn: new Date(),
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
    });
  }

  async clockOut(currentUser: CurrentUserData) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant context missing');

    const employee = await this.getEmployee(currentUser.email, tenantId);

    // Find active attendance
    const activeAttendance = await this.prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        tenantId: tenantId,
        checkOut: null,
      },
      orderBy: {
        checkIn: 'desc',
      },
    });

    if (!activeAttendance) {
      throw new BadRequestException('Not clocked in');
    }

    return this.prisma.attendance.update({
      where: { id: activeAttendance.id },
      data: {
        checkOut: new Date(),
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
    });
  }

  async findAll(currentUser: CurrentUserData) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant context missing');

    const records = await this.prisma.attendance.findMany({
      where: {
        tenantId: tenantId,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
      orderBy: {
        checkIn: 'desc',
      },
    });

    return records.map(record => {
      let workHours = null;
      if (record.checkIn && record.checkOut) {
        const diffMs = record.checkOut.getTime() - record.checkIn.getTime();
        workHours = diffMs / (1000 * 60 * 60);
      }
      return { ...record, workHours };
    });
  }

  async getStatus(currentUser: CurrentUserData) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant context missing');

    const employee = await this.prisma.employee.findFirst({
      where: {
        email: currentUser.email,
        tenantId: tenantId,
      },
    });

    if (!employee) {
      return { isClockedIn: false, lastAttendance: null };
    }

    const lastAttendance = await this.prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        tenantId: tenantId,
      },
      orderBy: {
        checkIn: 'desc',
      },
    });

    return {
      isClockedIn: lastAttendance ? !lastAttendance.checkOut : false,
      lastAttendance,
    };
  }

  async exportReport(employeeId: string, month: string) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    if (!tenantId) throw new BadRequestException('Tenant context missing');

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId, tenantId: tenantId },
      include: { department: true }
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const startDate = new Date(`${month}-01T00:00:00Z`);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59);

    const attendanceRecords = await this.prisma.attendance.findMany({
      where: {
        employeeId: employeeId,
        tenantId: tenantId,
        checkIn: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        checkIn: 'asc',
      },
    });

    return this.generateAttendancePdf(employee, month, attendanceRecords);
  }

  private async generateAttendancePdf(employee: any, month: string, records: any[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: any[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Company Header
      doc.fontSize(20).text('AMDOX ENTERPRISE', { align: 'center' });
      doc.fontSize(14).text('Attendance Report', { align: 'center' });
      doc.moveDown();

      // Employee Info
      doc.fontSize(10).font('Helvetica-Bold').text('Employee Details');
      doc.font('Helvetica').text(`Name: ${employee.firstName} ${employee.lastName}`);
      doc.text(`Employee Code: ${employee.employeeCode}`);
      doc.text(`Department: ${employee.department?.name || 'N/A'}`);
      doc.text(`Month: ${month}`);
      doc.moveDown();

      // Table Header
      const startX = 50;
      let currentY = doc.y;
      doc.font('Helvetica-Bold');
      doc.text('Date', startX, currentY);
      doc.text('Check-In', startX + 100, currentY);
      doc.text('Check-Out', startX + 250, currentY);
      doc.text('Total Hours', startX + 400, currentY);
      
      doc.moveTo(startX, currentY + 15).lineTo(550, currentY + 15).stroke();
      doc.moveDown(0.5);

      // Table Rows
      doc.font('Helvetica');
      records.forEach(record => {
        if (doc.y > 700) {
          doc.addPage();
          currentY = 50;
        } else {
          currentY = doc.y;
        }
        
        const checkIn = new Date(record.checkIn);
        const checkOut = record.checkOut ? new Date(record.checkOut) : null;
        
        let totalHours = 'N/A';
        if (checkOut) {
          const diffMs = checkOut.getTime() - checkIn.getTime();
          totalHours = (diffMs / (1000 * 60 * 60)).toFixed(2);
        }

        doc.text(checkIn.toISOString().split('T')[0], startX, currentY);
        doc.text(checkIn.toISOString().split('T')[1].substring(0, 8), startX + 100, currentY);
        doc.text(checkOut ? checkOut.toISOString().split('T')[1].substring(0, 8) : 'N/A', startX + 250, currentY);
        doc.text(totalHours, startX + 400, currentY);
        doc.moveDown();
      });

      doc.end();
    });
  }
}
