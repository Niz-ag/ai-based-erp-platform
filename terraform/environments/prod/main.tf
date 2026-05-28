/**
 * AI MANDATE: Planetary-Scale Infrastructure (Phase 4 Strategy)
 * Terraform configuration for AMDOX EKS (Elastic Kubernetes Service).
 * Architecture: Multi-AZ, Active-Active, Highly Available.
 */

module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  name   = "amdox-prod-vpc"
  cidr   = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = false # High Availability
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "amdox-planetary-cluster"
  cluster_version = "1.31"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    general = {
      instance_types = ["m6i.xlarge"]
      min_size     = 3
      max_size     = 100 # Planetary Scaling
      desired_size = 10
    }
  }
}
