locals {
  prefer_controller = {
    weight = 100
    preference = {
      matchExpressions = [
        {
          key      = "node.kubernetes.io/class"
          operator = "In"
          values   = ["controller"]
        }
      ]
    }
  }
  prefer_spot = {
    weight = 50
    preference = {
      matchExpressions = [{
        key      = "node.kubernetes.io/class"
        operator = "In"
        values   = ["spot"]
      }]
    }
  }
}
