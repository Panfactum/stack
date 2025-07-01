export interface IEKSClusterInfo {
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

export interface IAutoScalingGroup {
  name: string
  minSize: number
  maxSize: number
  desiredCapacity: number
}