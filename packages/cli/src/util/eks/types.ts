export interface EKSClusterInfo {
  name: string
  arn: string
  status: string
  version: string
  endpoint: string
  certificateAuthority: {
    data: string
  }
  tags?: Record<string, string>
}

export interface AutoScalingGroup {
  name: string
  minSize: number
  maxSize: number
  desiredCapacity: number
}