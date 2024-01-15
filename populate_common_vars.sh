#!/usr/bin/env bash

set -eo pipefail

cd modules

for i in $(ls -d */); 
do 
    cd ${i}
    cp ../../common_vars.tf common_vars.tf
    cd ..
done