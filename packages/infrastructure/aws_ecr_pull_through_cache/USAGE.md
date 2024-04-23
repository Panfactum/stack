## Usage

### Upstream Registry Credentials

For some of the upstream registries, you MUST provide authentication information
even if you are only accessing publicly available images (AWS limitation):

- Docker Hub: [Instructions](https://docs.docker.com/security/for-developers/access-tokens/)
- GitHub: [Instruction](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

### Configuring Repository Template

Pull through cache image repositories are dynamically created. You can control settings
for those image repositories by setting up a 
[creation template](https://docs.aws.amazon.com/AmazonECR/latest/userguide/repository-creation-templates.html).

Unfortunately, AWS does not currently offer an API for that 
(tracked [here](https://github.com/hashicorp/terraform-provider-aws/issues/34503)).
As a result, you will currently need to set this up manually after applying this module.