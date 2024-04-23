'use client'

import { keyframes } from '@emotion/react'
import styled from '@emotion/styled'
import type { ImageProps } from 'next/image'
import Image from 'next/image'

import argoImg from './argo.svg'
import authentikImg from './authentik.svg'
import awsImg from './aws.svg'
import certManagerImg from './cert-manager.svg'
import ciliumImg from './cilium.svg'
import devenvImg from './devenv.svg'
import grafanaImg from './grafana.svg'
import karpenterImg from './karpenter.svg'
import kubernetesImg from './kubernetes.svg'
import linkerdImg from './linkerd.svg'
import nginxImg from './nginx.svg'
import nixImg from './nix.svg'
import opentofuImg from './opentofu.svg'
import postgresImg from './postgres.svg'
import prometheusImg from './prometheus.svg'
import redisImg from './redis.svg'
import tiltImg from './tilt.svg'
import vaultImg from './vault.svg'
import veleroImg from './velero.svg'

// Use on SVGs that need to be converted to white text
function WhiteSVG (props: ImageProps) {
  return (
    <Image
      {...props}
      alt={props.alt}
      height={40}
      className={'h-[25px] sm:h-[40px]'}
      style={{ filter: 'invert(100%) sepia(100%) saturate(0%) hue-rotate(296deg) brightness(108%) contrast(106%)' }}
    />
  )
}

// Use on SVGs that are already white text
function GrayscaleSVG (props: ImageProps) {
  return (
    <Image
      {...props}
      alt={props.alt}
      height={40}
      className={'h-[25px] sm:h-[40px]'}
      style={{ filter: 'grayscale(1)' }}
    />
  )
}

const bounce = keyframes`
  0% {
      margin-left: 50px;
  }
  100% {
      margin-left: -4175px;
  }
`

const Banner = styled.div`
    & > :first-child {
        animation: ${bounce} 180s linear infinite;
    }

`

export default function Carousel () {
  return (
    <Banner
      className="bg-primary h-[50px] sm:h-[80px] border-y-gray-dark border-y-4 flex items-center gap-10 sm:gap-20"
    >
      <WhiteSVG
        src={awsImg as string}
        alt={'AWS'}
      />
      <WhiteSVG
        src={kubernetesImg as string}
        alt={'Kubernetes'}
      />
      <GrayscaleSVG
        src={opentofuImg as string}
        alt={'OpenTofu'}
      />
      <div className="flex flex-shrink-0 items-center min-w-[100px] w-[100px] text-gray-dark text-2xl gap-2 font-semibold">
        <WhiteSVG
          src={nixImg as string}
          alt={'Nix'}
        />
        Nix
      </div>
      <WhiteSVG
        src={tiltImg as string}
        alt={'Tilt'}
      />
      <div className="flex flex-shrink-0 items-center min-w-[100px] w-[100px] text-gray-dark text-2xl gap-2 font-semibold">
        <WhiteSVG
          src={devenvImg as string}
          alt={'Nix'}
        />
        devenv
      </div>
      <WhiteSVG
        src={linkerdImg as string}
        alt={'Linkerd2'}
      />
      <WhiteSVG
        src={ciliumImg as string}
        alt={'Cilium'}
      />
      <WhiteSVG
        src={argoImg as string}
        alt={'Argo'}
      />
      <WhiteSVG
        src={authentikImg as string}
        alt={'Authentik'}
      />
      <WhiteSVG
        src={veleroImg as string}
        alt={'Velero'}
      />
      <WhiteSVG
        src={grafanaImg as string}
        alt={'Grafana'}
      />
      <WhiteSVG
        src={prometheusImg as string}
        alt={'Prometheus'}
      />
      <WhiteSVG
        src={postgresImg as string}
        alt={'PostgreSQL'}
      />
      <WhiteSVG
        src={redisImg as string}
        alt={'Redis'}
      />
      <WhiteSVG
        src={vaultImg as string}
        alt={'Hashicorp Vault'}
      />
      <WhiteSVG
        src={nginxImg as string}
        alt={'NGINX'}
      />
      <WhiteSVG
        src={karpenterImg as string}
        alt={'Karpenter'}
      />
      <WhiteSVG
        src={certManagerImg as string}
        alt={'cert-manager'}
      />

      <WhiteSVG
        src={awsImg as string}
        alt={'AWS'}
      />
      <WhiteSVG
        src={kubernetesImg as string}
        alt={'Kubernetes'}
      />
      <GrayscaleSVG
        src={opentofuImg as string}
        alt={'OpenTofu'}
      />
      <div className="flex flex-shrink-0 items-center min-w-[100px] w-[100px] text-white text-2xl gap-2 font-semibold">
        <WhiteSVG
          src={nixImg as string}
          alt={'Nix'}
        />
        Nix
      </div>
      <WhiteSVG
        src={tiltImg as string}
        alt={'Tilt'}
      />
      <div className="flex flex-shrink-0 items-center min-w-[100px] w-[100px] text-white text-2xl gap-2 font-semibold">
        <WhiteSVG
          src={devenvImg as string}
          alt={'Nix'}
        />
        devenv
      </div>
      <WhiteSVG
        src={linkerdImg as string}
        alt={'Linkerd2'}
      />
      <WhiteSVG
        src={ciliumImg as string}
        alt={'Cilium'}
      />
      <WhiteSVG
        src={argoImg as string}
        alt={'Argo'}
      />
      <WhiteSVG
        src={authentikImg as string}
        alt={'Authentik'}
      />
      <WhiteSVG
        src={veleroImg as string}
        alt={'Velero'}
      />
      <WhiteSVG
        src={grafanaImg as string}
        alt={'Grafana'}
      />
      <WhiteSVG
        src={prometheusImg as string}
        alt={'Prometheus'}
      />
      <WhiteSVG
        src={postgresImg as string}
        alt={'PostgreSQL'}
      />
      <WhiteSVG
        src={redisImg as string}
        alt={'Redis'}
      />
      <WhiteSVG
        src={vaultImg as string}
        alt={'Hashicorp Vault'}
      />
      <WhiteSVG
        src={nginxImg as string}
        alt={'NGINX'}
      />
      <WhiteSVG
        src={karpenterImg as string}
        alt={'Karpenter'}
      />
      <WhiteSVG
        src={certManagerImg as string}
        alt={'cert-manager'}
      />

    </Banner>
  )
}
