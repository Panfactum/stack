## Maintainer Notes

We make heavy use of `random_id` and `create_before_destroy` because Karpenter often updates its CRD spec,
and changes to this spec requires destroying old CRs. However, we cannot just naively destroy these CRs as (a) destroying
a CR de-provisions all nodes created by it and (b) destroying all CRs at once would leave Karpenter unable
to create new nodes for the disrupted pods. Obviously this is not desirable in a live cluster. 

As a result, we
create new CRs **before** destroying the old ones so that when we destroy the old ones, Karpenter can
create new nodes for the disrupted pods.