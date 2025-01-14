import { faCircleCheck } from "@fortawesome/free-regular-svg-icons";
import {
  faMinus,
  faChevronDown,
  faChevronLeft,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { type FC, type ReactNode, useState, Fragment } from "react";
import { PricingHeader } from "@/components/pricing/pricing-header";
import { PricingTableQty } from "@/components/pricing/pricing-table-qty";

export enum FeatureName {
  Clusters = "Clusters",
  ApplicationServices = "Application Services",
  Addons = "Addons",
  ImplementationSupport = "Implementation Support",
  SupportHours = "Support Hours",
  SupportSLA1 = "Support SLAs - Priority 1",
  SupportSLA2 = "Support SLAs - Priority 2",
  SupportSLA3 = "Support SLAs - Priority 3",
  DelegatedSystemAccess = "Delegated System Access",
  DedicatedSolutionEngineer = "Dedicated Solution Engineer",
  Training = "Training",
  ManagedSetup = "Managed Setup",
  ManagedUpgrades = "Managed Upgrades",
  ActiveMonitoring = "Active Monitoring",
  PlatformAssessment = "Platform Assessments",
  FractionalDevOps = "Fractional DevOps",
  BAACustomLicense = "BAA / Custom License",
  StableReleaseAccess = "Stable Release Access",
  RoadmapPrioritization = "Roadmap Prioritization",
  ChatIntegration = "Chat Integration",
  BareMetalSupport = "Bare Metal Support",
}

interface Feature {
  name: FeatureName;
  description?: ReactNode | string;
}

type Features = {
  [key in FeatureName]: Feature;
};

interface PlanFeature {
  feature: Feature;
  name: FeatureName;
  included: boolean;
  hours?: number;
  qty?: {
    included: number;
    price: number;
    additional?: number;
  };
}

export interface Plan {
  name: string;
  price: number;
  description: string;
  features: {
    [key in FeatureName]: PlanFeature;
  };
  popular: boolean;
}

const featureOrder: FeatureName[] = [
  FeatureName.Clusters,
  FeatureName.ApplicationServices,
  FeatureName.Addons,
  FeatureName.ImplementationSupport,
  FeatureName.SupportHours,
  FeatureName.SupportSLA1,
  FeatureName.SupportSLA2,
  FeatureName.SupportSLA3,
  FeatureName.DelegatedSystemAccess,
  FeatureName.DedicatedSolutionEngineer,
  FeatureName.Training,
  FeatureName.ManagedSetup,
  FeatureName.ManagedUpgrades,
  FeatureName.ActiveMonitoring,
  FeatureName.PlatformAssessment,
  FeatureName.FractionalDevOps,
  FeatureName.BAACustomLicense,
  FeatureName.StableReleaseAccess,
  FeatureName.RoadmapPrioritization,
  FeatureName.ChatIntegration,
  FeatureName.BareMetalSupport,
];

export const features: Features = {
  [FeatureName.Clusters]: {
    name: FeatureName.Clusters,
    description: (
      <>
        <p>
          The Managed Setup for Panfactum is a comprehensive service designed to
          accelerate and streamline the implementation of Panfactum for
          developers and organizations looking to harness its full potential. By
          leveraging expert guidance and hands-on support, the Managed Setup
          ensures that every aspect of Panfactum’s deployment is optimized for
          maximum efficiency, allowing teams to focus on innovation rather than
          infrastructure and configuration challenges.
        </p>
        <b>Key Features of Managed Setup</b>
        <ol>
          <li>
            Customized Configuration Each project is unique, and Panfactum’s
            Managed Setup is designed to reflect that. The configuration process
            includes understanding your specific goals and challenges, which
            allows us to configure the system in a way that matches your needs
            perfectly. From custom rulesets to unique workflows, the setup is
            tailored to your operational demands.
          </li>
          <li>
            Hands-On Guidance and Training As part of the Managed Setup, your
            team receives training and hands-on guidance in Panfactum’s tools
            and workflows. This includes detailed documentation, onboarding
            materials, and workshops aimed at empowering your developers to use
            Panfactum effectively, ensuring they can take full advantage of its
            capabilities.
          </li>
          <li>
            Ongoing Support and Maintenance Post-setup, we provide ongoing
            support, so your team can operate with confidence. Whether it's
            troubleshooting, updates, or scaling the system as your needs grow,
            our experts are always available to assist, ensuring Panfactum
            continues to meet evolving requirements.
          </li>
          <li>
            Accelerated Time to Value By offloading the setup process to
            experts, your team can begin using Panfactum’s advanced features
            much sooner. Instead of spending weeks or months on configurations
            and integrations, the Managed Setup ensures Panfactum is ready for
            use in a fraction of the time, accelerating your project timelines
            and delivering value faster.
          </li>
        </ol>
        <b>Benefits for Your Team</b>
        <p>
          Reduced Complexity: Our team handles the intricate setup details,
          allowing your developers to focus on core project objectives rather
          than learning complex new systems. Improved Efficiency: With
          Panfactum’s Managed Setup, you’ll save time and resources, ensuring
          projects are delivered on time and within budget. Scalability: The
          service sets you up for future growth, enabling you to easily scale
          projects as needed without costly infrastructure changes or
          disruptions.
        </p>
      </>
    ),
  },
  [FeatureName.ApplicationServices]: {
    name: FeatureName.ApplicationServices,
    description:
      "Application Services are services that run your applications.",
  },
  [FeatureName.Addons]: {
    name: FeatureName.Addons,
    description:
      "Addons are additional services that can be added to your Panfactum account.",
  },
  [FeatureName.ImplementationSupport]: {
    name: FeatureName.ImplementationSupport,
    description:
      "Implementation Support is a service that helps you implement Panfactum.",
  },
  [FeatureName.SupportHours]: {
    name: FeatureName.SupportHours,
    description: (
      <>
        <p>
          The Managed Setup for Panfactum is a comprehensive service designed to
          accelerate and streamline the implementation of Panfactum for
          developers and organizations looking to harness its full potential. By
          leveraging expert guidance and hands-on support, the Managed Setup
          ensures that every aspect of Panfactum’s deployment is optimized for
          maximum efficiency, allowing teams to focus on innovation rather than
          infrastructure and configuration challenges.
        </p>
        <b>Key Features of Managed Setup</b>
        <ol>
          <li>
            Customized Configuration Each project is unique, and Panfactum’s
            Managed Setup is designed to reflect that. The configuration process
            includes understanding your specific goals and challenges, which
            allows us to configure the system in a way that matches your needs
            perfectly. From custom rulesets to unique workflows, the setup is
            tailored to your operational demands.
          </li>
          <li>
            Hands-On Guidance and Training As part of the Managed Setup, your
            team receives training and hands-on guidance in Panfactum’s tools
            and workflows. This includes detailed documentation, onboarding
            materials, and workshops aimed at empowering your developers to use
            Panfactum effectively, ensuring they can take full advantage of its
            capabilities.
          </li>
          <li>
            Ongoing Support and Maintenance Post-setup, we provide ongoing
            support, so your team can operate with confidence. Whether it's
            troubleshooting, updates, or scaling the system as your needs grow,
            our experts are always available to assist, ensuring Panfactum
            continues to meet evolving requirements.
          </li>
          <li>
            Accelerated Time to Value By offloading the setup process to
            experts, your team can begin using Panfactum’s advanced features
            much sooner. Instead of spending weeks or months on configurations
            and integrations, the Managed Setup ensures Panfactum is ready for
            use in a fraction of the time, accelerating your project timelines
            and delivering value faster.
          </li>
        </ol>
        <b>Benefits for Your Team</b>
        <p>
          Reduced Complexity: Our team handles the intricate setup details,
          allowing your developers to focus on core project objectives rather
          than learning complex new systems. Improved Efficiency: With
          Panfactum’s Managed Setup, you’ll save time and resources, ensuring
          projects are delivered on time and within budget. Scalability: The
          service sets you up for future growth, enabling you to easily scale
          projects as needed without costly infrastructure changes or
          disruptions.
        </p>
      </>
    ),
  },

  [FeatureName.SupportSLA1]: {
    name: FeatureName.SupportSLA1,
    description: (
      <>
        <p>
          The Managed Setup for Panfactum is a comprehensive service designed to
          accelerate and streamline the implementation of Panfactum for
          developers and organizations looking to harness its full potential. By
          leveraging expert guidance and hands-on support, the Managed Setup
          ensures that every aspect of Panfactum’s deployment is optimized for
          maximum efficiency, allowing teams to focus on innovation rather than
          infrastructure and configuration challenges.
        </p>
        <b>Key Features of Managed Setup</b>
        <ol>
          <li>
            Customized Configuration Each project is unique, and Panfactum’s
            Managed Setup is designed to reflect that. The configuration process
            includes understanding your specific goals and challenges, which
            allows us to configure the system in a way that matches your needs
            perfectly. From custom rulesets to unique workflows, the setup is
            tailored to your operational demands.
          </li>
          <li>
            Hands-On Guidance and Training As part of the Managed Setup, your
            team receives training and hands-on guidance in Panfactum’s tools
            and workflows. This includes detailed documentation, onboarding
            materials, and workshops aimed at empowering your developers to use
            Panfactum effectively, ensuring they can take full advantage of its
            capabilities.
          </li>
          <li>
            Ongoing Support and Maintenance Post-setup, we provide ongoing
            support, so your team can operate with confidence. Whether it's
            troubleshooting, updates, or scaling the system as your needs grow,
            our experts are always available to assist, ensuring Panfactum
            continues to meet evolving requirements.
          </li>
          <li>
            Accelerated Time to Value By offloading the setup process to
            experts, your team can begin using Panfactum’s advanced features
            much sooner. Instead of spending weeks or months on configurations
            and integrations, the Managed Setup ensures Panfactum is ready for
            use in a fraction of the time, accelerating your project timelines
            and delivering value faster.
          </li>
        </ol>
        <b>Benefits for Your Team</b>
        <p>
          Reduced Complexity: Our team handles the intricate setup details,
          allowing your developers to focus on core project objectives rather
          than learning complex new systems. Improved Efficiency: With
          Panfactum’s Managed Setup, you’ll save time and resources, ensuring
          projects are delivered on time and within budget. Scalability: The
          service sets you up for future growth, enabling you to easily scale
          projects as needed without costly infrastructure changes or
          disruptions.
        </p>
      </>
    ),
  },
  [FeatureName.SupportSLA2]: {
    name: FeatureName.SupportSLA2,
    description: (
      <>
        <p>
          The Managed Setup for Panfactum is a comprehensive service designed to
          accelerate and streamline the implementation of Panfactum for
          developers and organizations looking to harness its full potential. By
          leveraging expert guidance and hands-on support, the Managed Setup
          ensures that every aspect of Panfactum’s deployment is optimized for
          maximum efficiency, allowing teams to focus on innovation rather than
          infrastructure and configuration challenges.
        </p>
        <b>Key Features of Managed Setup</b>
        <ol>
          <li>
            Customized Configuration Each project is unique, and Panfactum’s
            Managed Setup is designed to reflect that. The configuration process
            includes understanding your specific goals and challenges, which
            allows us to configure the system in a way that matches your needs
            perfectly. From custom rulesets to unique workflows, the setup is
            tailored to your operational demands.
          </li>
          <li>
            Hands-On Guidance and Training As part of the Managed Setup, your
            team receives training and hands-on guidance in Panfactum’s tools
            and workflows. This includes detailed documentation, onboarding
            materials, and workshops aimed at empowering your developers to use
            Panfactum effectively, ensuring they can take full advantage of its
            capabilities.
          </li>
          <li>
            Ongoing Support and Maintenance Post-setup, we provide ongoing
            support, so your team can operate with confidence. Whether it's
            troubleshooting, updates, or scaling the system as your needs grow,
            our experts are always available to assist, ensuring Panfactum
            continues to meet evolving requirements.
          </li>
          <li>
            Accelerated Time to Value By offloading the setup process to
            experts, your team can begin using Panfactum’s advanced features
            much sooner. Instead of spending weeks or months on configurations
            and integrations, the Managed Setup ensures Panfactum is ready for
            use in a fraction of the time, accelerating your project timelines
            and delivering value faster.
          </li>
        </ol>
        <b>Benefits for Your Team</b>
        <p>
          Reduced Complexity: Our team handles the intricate setup details,
          allowing your developers to focus on core project objectives rather
          than learning complex new systems. Improved Efficiency: With
          Panfactum’s Managed Setup, you’ll save time and resources, ensuring
          projects are delivered on time and within budget. Scalability: The
          service sets you up for future growth, enabling you to easily scale
          projects as needed without costly infrastructure changes or
          disruptions.
        </p>
      </>
    ),
  },
  [FeatureName.SupportSLA3]: {
    name: FeatureName.SupportSLA3,
    description: (
      <>
        <p>
          The Managed Setup for Panfactum is a comprehensive service designed to
          accelerate and streamline the implementation of Panfactum for
          developers and organizations looking to harness its full potential. By
          leveraging expert guidance and hands-on support, the Managed Setup
          ensures that every aspect of Panfactum’s deployment is optimized for
          maximum efficiency, allowing teams to focus on innovation rather than
          infrastructure and configuration challenges.
        </p>
        <b>Key Features of Managed Setup</b>
        <ol>
          <li>
            Customized Configuration Each project is unique, and Panfactum’s
            Managed Setup is designed to reflect that. The configuration process
            includes understanding your specific goals and challenges, which
            allows us to configure the system in a way that matches your needs
            perfectly. From custom rulesets to unique workflows, the setup is
            tailored to your operational demands.
          </li>
          <li>
            Hands-On Guidance and Training As part of the Managed Setup, your
            team receives training and hands-on guidance in Panfactum’s tools
            and workflows. This includes detailed documentation, onboarding
            materials, and workshops aimed at empowering your developers to use
            Panfactum effectively, ensuring they can take full advantage of its
            capabilities.
          </li>
          <li>
            Ongoing Support and Maintenance Post-setup, we provide ongoing
            support, so your team can operate with confidence. Whether it's
            troubleshooting, updates, or scaling the system as your needs grow,
            our experts are always available to assist, ensuring Panfactum
            continues to meet evolving requirements.
          </li>
          <li>
            Accelerated Time to Value By offloading the setup process to
            experts, your team can begin using Panfactum’s advanced features
            much sooner. Instead of spending weeks or months on configurations
            and integrations, the Managed Setup ensures Panfactum is ready for
            use in a fraction of the time, accelerating your project timelines
            and delivering value faster.
          </li>
        </ol>
        <b>Benefits for Your Team</b>
        <p>
          Reduced Complexity: Our team handles the intricate setup details,
          allowing your developers to focus on core project objectives rather
          than learning complex new systems. Improved Efficiency: With
          Panfactum’s Managed Setup, you’ll save time and resources, ensuring
          projects are delivered on time and within budget. Scalability: The
          service sets you up for future growth, enabling you to easily scale
          projects as needed without costly infrastructure changes or
          disruptions.
        </p>
      </>
    ),
  },
  [FeatureName.DelegatedSystemAccess]: {
    name: FeatureName.DelegatedSystemAccess,
    description: (
      <>
        <p>
          The Managed Setup for Panfactum is a comprehensive service designed to
          accelerate and streamline the implementation of Panfactum for
          developers and organizations looking to harness its full potential. By
          leveraging expert guidance and hands-on support, the Managed Setup
          ensures that every aspect of Panfactum’s deployment is optimized for
          maximum efficiency, allowing teams to focus on innovation rather than
          infrastructure and configuration challenges.
        </p>
        <b>Key Features of Managed Setup</b>
        <ol>
          <li>
            Customized Configuration Each project is unique, and Panfactum’s
            Managed Setup is designed to reflect that. The configuration process
            includes understanding your specific goals and challenges, which
            allows us to configure the system in a way that matches your needs
            perfectly. From custom rulesets to unique workflows, the setup is
            tailored to your operational demands.
          </li>
          <li>
            Hands-On Guidance and Training As part of the Managed Setup, your
            team receives training and hands-on guidance in Panfactum’s tools
            and workflows. This includes detailed documentation, onboarding
            materials, and workshops aimed at empowering your developers to use
            Panfactum effectively, ensuring they can take full advantage of its
            capabilities.
          </li>
          <li>
            Ongoing Support and Maintenance Post-setup, we provide ongoing
            support, so your team can operate with confidence. Whether it's
            troubleshooting, updates, or scaling the system as your needs grow,
            our experts are always available to assist, ensuring Panfactum
            continues to meet evolving requirements.
          </li>
          <li>
            Accelerated Time to Value By offloading the setup process to
            experts, your team can begin using Panfactum’s advanced features
            much sooner. Instead of spending weeks or months on configurations
            and integrations, the Managed Setup ensures Panfactum is ready for
            use in a fraction of the time, accelerating your project timelines
            and delivering value faster.
          </li>
        </ol>
        <b>Benefits for Your Team</b>
        <p>
          Reduced Complexity: Our team handles the intricate setup details,
          allowing your developers to focus on core project objectives rather
          than learning complex new systems. Improved Efficiency: With
          Panfactum’s Managed Setup, you’ll save time and resources, ensuring
          projects are delivered on time and within budget. Scalability: The
          service sets you up for future growth, enabling you to easily scale
          projects as needed without costly infrastructure changes or
          disruptions.
        </p>
      </>
    ),
  },
  [FeatureName.DedicatedSolutionEngineer]: {
    name: FeatureName.DedicatedSolutionEngineer,
    description: (
      <>
        <p>
          The Managed Setup for Panfactum is a comprehensive service designed to
          accelerate and streamline the implementation of Panfactum for
          developers and organizations looking to harness its full potential. By
          leveraging expert guidance and hands-on support, the Managed Setup
          ensures that every aspect of Panfactum’s deployment is optimized for
          maximum efficiency, allowing teams to focus on innovation rather than
          infrastructure and configuration challenges.
        </p>
        <b>Key Features of Managed Setup</b>
        <ol>
          <li>
            Customized Configuration Each project is unique, and Panfactum’s
            Managed Setup is designed to reflect that. The configuration process
            includes understanding your specific goals and challenges, which
            allows us to configure the system in a way that matches your needs
            perfectly. From custom rulesets to unique workflows, the setup is
            tailored to your operational demands.
          </li>
          <li>
            Hands-On Guidance and Training As part of the Managed Setup, your
            team receives training and hands-on guidance in Panfactum’s tools
            and workflows. This includes detailed documentation, onboarding
            materials, and workshops aimed at empowering your developers to use
            Panfactum effectively, ensuring they can take full advantage of its
            capabilities.
          </li>
          <li>
            Ongoing Support and Maintenance Post-setup, we provide ongoing
            support, so your team can operate with confidence. Whether it's
            troubleshooting, updates, or scaling the system as your needs grow,
            our experts are always available to assist, ensuring Panfactum
            continues to meet evolving requirements.
          </li>
          <li>
            Accelerated Time to Value By offloading the setup process to
            experts, your team can begin using Panfactum’s advanced features
            much sooner. Instead of spending weeks or months on configurations
            and integrations, the Managed Setup ensures Panfactum is ready for
            use in a fraction of the time, accelerating your project timelines
            and delivering value faster.
          </li>
        </ol>
        <b>Benefits for Your Team</b>
        <p>
          Reduced Complexity: Our team handles the intricate setup details,
          allowing your developers to focus on core project objectives rather
          than learning complex new systems. Improved Efficiency: With
          Panfactum’s Managed Setup, you’ll save time and resources, ensuring
          projects are delivered on time and within budget. Scalability: The
          service sets you up for future growth, enabling you to easily scale
          projects as needed without costly infrastructure changes or
          disruptions.
        </p>
      </>
    ),
  },
  [FeatureName.Training]: {
    name: FeatureName.Training,
    description: (
      <>
        <p>
          The Managed Setup for Panfactum is a comprehensive service designed to
          accelerate and streamline the implementation of Panfactum for
          developers and organizations looking to harness its full potential. By
          leveraging expert guidance and hands-on support, the Managed Setup
          ensures that every aspect of Panfactum’s deployment is optimized for
          maximum efficiency, allowing teams to focus on innovation rather than
          infrastructure and configuration challenges.
        </p>
        <b>Key Features of Managed Setup</b>
        <ol>
          <li>
            Customized Configuration Each project is unique, and Panfactum’s
            Managed Setup is designed to reflect that. The configuration process
            includes understanding your specific goals and challenges, which
            allows us to configure the system in a way that matches your needs
            perfectly. From custom rulesets to unique workflows, the setup is
            tailored to your operational demands.
          </li>
          <li>
            Hands-On Guidance and Training As part of the Managed Setup, your
            team receives training and hands-on guidance in Panfactum’s tools
            and workflows. This includes detailed documentation, onboarding
            materials, and workshops aimed at empowering your developers to use
            Panfactum effectively, ensuring they can take full advantage of its
            capabilities.
          </li>
          <li>
            Ongoing Support and Maintenance Post-setup, we provide ongoing
            support, so your team can operate with confidence. Whether it's
            troubleshooting, updates, or scaling the system as your needs grow,
            our experts are always available to assist, ensuring Panfactum
            continues to meet evolving requirements.
          </li>
          <li>
            Accelerated Time to Value By offloading the setup process to
            experts, your team can begin using Panfactum’s advanced features
            much sooner. Instead of spending weeks or months on configurations
            and integrations, the Managed Setup ensures Panfactum is ready for
            use in a fraction of the time, accelerating your project timelines
            and delivering value faster.
          </li>
        </ol>
        <b>Benefits for Your Team</b>
        <p>
          Reduced Complexity: Our team handles the intricate setup details,
          allowing your developers to focus on core project objectives rather
          than learning complex new systems. Improved Efficiency: With
          Panfactum’s Managed Setup, you’ll save time and resources, ensuring
          projects are delivered on time and within budget. Scalability: The
          service sets you up for future growth, enabling you to easily scale
          projects as needed without costly infrastructure changes or
          disruptions.
        </p>
      </>
    ),
  },
  [FeatureName.ManagedSetup]: {
    name: FeatureName.ManagedSetup,
    description: (
      <>
        <p>
          The Managed Setup for Panfactum is a comprehensive service designed to
          accelerate and streamline the implementation of Panfactum for
          developers and organizations looking to harness its full potential. By
          leveraging expert guidance and hands-on support, the Managed Setup
          ensures that every aspect of Panfactum’s deployment is optimized for
          maximum efficiency, allowing teams to focus on innovation rather than
          infrastructure and configuration challenges.
        </p>
        <b>Key Features of Managed Setup</b>
        <ol>
          <li>
            Customized Configuration Each project is unique, and Panfactum’s
            Managed Setup is designed to reflect that. The configuration process
            includes understanding your specific goals and challenges, which
            allows us to configure the system in a way that matches your needs
            perfectly. From custom rulesets to unique workflows, the setup is
            tailored to your operational demands.
          </li>
          <li>
            Hands-On Guidance and Training As part of the Managed Setup, your
            team receives training and hands-on guidance in Panfactum’s tools
            and workflows. This includes detailed documentation, onboarding
            materials, and workshops aimed at empowering your developers to use
            Panfactum effectively, ensuring they can take full advantage of its
            capabilities.
          </li>
          <li>
            Ongoing Support and Maintenance Post-setup, we provide ongoing
            support, so your team can operate with confidence. Whether it's
            troubleshooting, updates, or scaling the system as your needs grow,
            our experts are always available to assist, ensuring Panfactum
            continues to meet evolving requirements.
          </li>
          <li>
            Accelerated Time to Value By offloading the setup process to
            experts, your team can begin using Panfactum’s advanced features
            much sooner. Instead of spending weeks or months on configurations
            and integrations, the Managed Setup ensures Panfactum is ready for
            use in a fraction of the time, accelerating your project timelines
            and delivering value faster.
          </li>
        </ol>
        <b>Benefits for Your Team</b>
        <p>
          Reduced Complexity: Our team handles the intricate setup details,
          allowing your developers to focus on core project objectives rather
          than learning complex new systems. Improved Efficiency: With
          Panfactum’s Managed Setup, you’ll save time and resources, ensuring
          projects are delivered on time and within budget. Scalability: The
          service sets you up for future growth, enabling you to easily scale
          projects as needed without costly infrastructure changes or
          disruptions.
        </p>
      </>
    ),
  },
  [FeatureName.ManagedUpgrades]: {
    name: FeatureName.ManagedUpgrades,
    description: (
      <>
        <p>
          The Managed Setup for Panfactum is a comprehensive service designed to
          accelerate and streamline the implementation of Panfactum for
          developers and organizations looking to harness its full potential. By
          leveraging expert guidance and hands-on support, the Managed Setup
          ensures that every aspect of Panfactum’s deployment is optimized for
          maximum efficiency, allowing teams to focus on innovation rather than
          infrastructure and configuration challenges.
        </p>
        <b>Key Features of Managed Setup</b>
        <ol>
          <li>
            Customized Configuration Each project is unique, and Panfactum’s
            Managed Setup is designed to reflect that. The configuration process
            includes understanding your specific goals and challenges, which
            allows us to configure the system in a way that matches your needs
            perfectly. From custom rulesets to unique workflows, the setup is
            tailored to your operational demands.
          </li>
          <li>
            Hands-On Guidance and Training As part of the Managed Setup, your
            team receives training and hands-on guidance in Panfactum’s tools
            and workflows. This includes detailed documentation, onboarding
            materials, and workshops aimed at empowering your developers to use
            Panfactum effectively, ensuring they can take full advantage of its
            capabilities.
          </li>
          <li>
            Ongoing Support and Maintenance Post-setup, we provide ongoing
            support, so your team can operate with confidence. Whether it's
            troubleshooting, updates, or scaling the system as your needs grow,
            our experts are always available to assist, ensuring Panfactum
            continues to meet evolving requirements.
          </li>
          <li>
            Accelerated Time to Value By offloading the setup process to
            experts, your team can begin using Panfactum’s advanced features
            much sooner. Instead of spending weeks or months on configurations
            and integrations, the Managed Setup ensures Panfactum is ready for
            use in a fraction of the time, accelerating your project timelines
            and delivering value faster.
          </li>
        </ol>
        <b>Benefits for Your Team</b>
        <p>
          Reduced Complexity: Our team handles the intricate setup details,
          allowing your developers to focus on core project objectives rather
          than learning complex new systems. Improved Efficiency: With
          Panfactum’s Managed Setup, you’ll save time and resources, ensuring
          projects are delivered on time and within budget. Scalability: The
          service sets you up for future growth, enabling you to easily scale
          projects as needed without costly infrastructure changes or
          disruptions.
        </p>
      </>
    ),
  },
  [FeatureName.ActiveMonitoring]: {
    name: FeatureName.ActiveMonitoring,
    description: (
      <>
        <p>
          The Managed Setup for Panfactum is a comprehensive service designed to
          accelerate and streamline the implementation of Panfactum for
          developers and organizations looking to harness its full potential. By
          leveraging expert guidance and hands-on support, the Managed Setup
          ensures that every aspect of Panfactum’s deployment is optimized for
          maximum efficiency, allowing teams to focus on innovation rather than
          infrastructure and configuration challenges.
        </p>
        <b>Key Features of Managed Setup</b>
        <ol>
          <li>
            Customized Configuration Each project is unique, and Panfactum’s
            Managed Setup is designed to reflect that. The configuration process
            includes understanding your specific goals and challenges, which
            allows us to configure the system in a way that matches your needs
            perfectly. From custom rulesets to unique workflows, the setup is
            tailored to your operational demands.
          </li>
          <li>
            Hands-On Guidance and Training As part of the Managed Setup, your
            team receives training and hands-on guidance in Panfactum’s tools
            and workflows. This includes detailed documentation, onboarding
            materials, and workshops aimed at empowering your developers to use
            Panfactum effectively, ensuring they can take full advantage of its
            capabilities.
          </li>
          <li>
            Ongoing Support and Maintenance Post-setup, we provide ongoing
            support, so your team can operate with confidence. Whether it's
            troubleshooting, updates, or scaling the system as your needs grow,
            our experts are always available to assist, ensuring Panfactum
            continues to meet evolving requirements.
          </li>
          <li>
            Accelerated Time to Value By offloading the setup process to
            experts, your team can begin using Panfactum’s advanced features
            much sooner. Instead of spending weeks or months on configurations
            and integrations, the Managed Setup ensures Panfactum is ready for
            use in a fraction of the time, accelerating your project timelines
            and delivering value faster.
          </li>
        </ol>
        <b>Benefits for Your Team</b>
        <p>
          Reduced Complexity: Our team handles the intricate setup details,
          allowing your developers to focus on core project objectives rather
          than learning complex new systems. Improved Efficiency: With
          Panfactum’s Managed Setup, you’ll save time and resources, ensuring
          projects are delivered on time and within budget. Scalability: The
          service sets you up for future growth, enabling you to easily scale
          projects as needed without costly infrastructure changes or
          disruptions.
        </p>
      </>
    ),
  },
  [FeatureName.PlatformAssessment]: {
    name: FeatureName.PlatformAssessment,
    description: (
      <>
        <p>
          The Managed Setup for Panfactum is a comprehensive service designed to
          accelerate and streamline the implementation of Panfactum for
          developers and organizations looking to harness its full potential. By
          leveraging expert guidance and hands-on support, the Managed Setup
          ensures that every aspect of Panfactum’s deployment is optimized for
          maximum efficiency, allowing teams to focus on innovation rather than
          infrastructure and configuration challenges.
        </p>
        <b>Key Features of Managed Setup</b>
        <ol>
          <li>
            Customized Configuration Each project is unique, and Panfactum’s
            Managed Setup is designed to reflect that. The configuration process
            includes understanding your specific goals and challenges, which
            allows us to configure the system in a way that matches your needs
            perfectly. From custom rulesets to unique workflows, the setup is
            tailored to your operational demands.
          </li>
          <li>
            Hands-On Guidance and Training As part of the Managed Setup, your
            team receives training and hands-on guidance in Panfactum’s tools
            and workflows. This includes detailed documentation, onboarding
            materials, and workshops aimed at empowering your developers to use
            Panfactum effectively, ensuring they can take full advantage of its
            capabilities.
          </li>
          <li>
            Ongoing Support and Maintenance Post-setup, we provide ongoing
            support, so your team can operate with confidence. Whether it's
            troubleshooting, updates, or scaling the system as your needs grow,
            our experts are always available to assist, ensuring Panfactum
            continues to meet evolving requirements.
          </li>
          <li>
            Accelerated Time to Value By offloading the setup process to
            experts, your team can begin using Panfactum’s advanced features
            much sooner. Instead of spending weeks or months on configurations
            and integrations, the Managed Setup ensures Panfactum is ready for
            use in a fraction of the time, accelerating your project timelines
            and delivering value faster.
          </li>
        </ol>
        <b>Benefits for Your Team</b>
        <p>
          Reduced Complexity: Our team handles the intricate setup details,
          allowing your developers to focus on core project objectives rather
          than learning complex new systems. Improved Efficiency: With
          Panfactum’s Managed Setup, you’ll save time and resources, ensuring
          projects are delivered on time and within budget. Scalability: The
          service sets you up for future growth, enabling you to easily scale
          projects as needed without costly infrastructure changes or
          disruptions.
        </p>
      </>
    ),
  },
  [FeatureName.FractionalDevOps]: {
    name: FeatureName.FractionalDevOps,
    description: (
      <>
        <p>
          The Managed Setup for Panfactum is a comprehensive service designed to
          accelerate and streamline the implementation of Panfactum for
          developers and organizations looking to harness its full potential. By
          leveraging expert guidance and hands-on support, the Managed Setup
          ensures that every aspect of Panfactum’s deployment is optimized for
          maximum efficiency, allowing teams to focus on innovation rather than
          infrastructure and configuration challenges.
        </p>
        <b>Key Features of Managed Setup</b>
        <ol>
          <li>
            Customized Configuration Each project is unique, and Panfactum’s
            Managed Setup is designed to reflect that. The configuration process
            includes understanding your specific goals and challenges, which
            allows us to configure the system in a way that matches your needs
            perfectly. From custom rulesets to unique workflows, the setup is
            tailored to your operational demands.
          </li>
          <li>
            Hands-On Guidance and Training As part of the Managed Setup, your
            team receives training and hands-on guidance in Panfactum’s tools
            and workflows. This includes detailed documentation, onboarding
            materials, and workshops aimed at empowering your developers to use
            Panfactum effectively, ensuring they can take full advantage of its
            capabilities.
          </li>
          <li>
            Ongoing Support and Maintenance Post-setup, we provide ongoing
            support, so your team can operate with confidence. Whether it's
            troubleshooting, updates, or scaling the system as your needs grow,
            our experts are always available to assist, ensuring Panfactum
            continues to meet evolving requirements.
          </li>
          <li>
            Accelerated Time to Value By offloading the setup process to
            experts, your team can begin using Panfactum’s advanced features
            much sooner. Instead of spending weeks or months on configurations
            and integrations, the Managed Setup ensures Panfactum is ready for
            use in a fraction of the time, accelerating your project timelines
            and delivering value faster.
          </li>
        </ol>
        <b>Benefits for Your Team</b>
        <p>
          Reduced Complexity: Our team handles the intricate setup details,
          allowing your developers to focus on core project objectives rather
          than learning complex new systems. Improved Efficiency: With
          Panfactum’s Managed Setup, you’ll save time and resources, ensuring
          projects are delivered on time and within budget. Scalability: The
          service sets you up for future growth, enabling you to easily scale
          projects as needed without costly infrastructure changes or
          disruptions.
        </p>
      </>
    ),
  },
  [FeatureName.BAACustomLicense]: {
    name: FeatureName.BAACustomLicense,
    description: (
      <>
        <p>
          The Managed Setup for Panfactum is a comprehensive service designed to
          accelerate and streamline the implementation of Panfactum for
          developers and organizations looking to harness its full potential. By
          leveraging expert guidance and hands-on support, the Managed Setup
          ensures that every aspect of Panfactum’s deployment is optimized for
          maximum efficiency, allowing teams to focus on innovation rather than
          infrastructure and configuration challenges.
        </p>
        <b>Key Features of Managed Setup</b>
        <ol>
          <li>
            Customized Configuration Each project is unique, and Panfactum’s
            Managed Setup is designed to reflect that. The configuration process
            includes understanding your specific goals and challenges, which
            allows us to configure the system in a way that matches your needs
            perfectly. From custom rulesets to unique workflows, the setup is
            tailored to your operational demands.
          </li>
          <li>
            Hands-On Guidance and Training As part of the Managed Setup, your
            team receives training and hands-on guidance in Panfactum’s tools
            and workflows. This includes detailed documentation, onboarding
            materials, and workshops aimed at empowering your developers to use
            Panfactum effectively, ensuring they can take full advantage of its
            capabilities.
          </li>
          <li>
            Ongoing Support and Maintenance Post-setup, we provide ongoing
            support, so your team can operate with confidence. Whether it's
            troubleshooting, updates, or scaling the system as your needs grow,
            our experts are always available to assist, ensuring Panfactum
            continues to meet evolving requirements.
          </li>
          <li>
            Accelerated Time to Value By offloading the setup process to
            experts, your team can begin using Panfactum’s advanced features
            much sooner. Instead of spending weeks or months on configurations
            and integrations, the Managed Setup ensures Panfactum is ready for
            use in a fraction of the time, accelerating your project timelines
            and delivering value faster.
          </li>
        </ol>
        <b>Benefits for Your Team</b>
        <p>
          Reduced Complexity: Our team handles the intricate setup details,
          allowing your developers to focus on core project objectives rather
          than learning complex new systems. Improved Efficiency: With
          Panfactum’s Managed Setup, you’ll save time and resources, ensuring
          projects are delivered on time and within budget. Scalability: The
          service sets you up for future growth, enabling you to easily scale
          projects as needed without costly infrastructure changes or
          disruptions.
        </p>
      </>
    ),
  },
  [FeatureName.StableReleaseAccess]: {
    name: FeatureName.StableReleaseAccess,
    description: (
      <>
        <p>
          The Managed Setup for Panfactum is a comprehensive service designed to
          accelerate and streamline the implementation of Panfactum for
          developers and organizations looking to harness its full potential. By
          leveraging expert guidance and hands-on support, the Managed Setup
          ensures that every aspect of Panfactum’s deployment is optimized for
          maximum efficiency, allowing teams to focus on innovation rather than
          infrastructure and configuration challenges.
        </p>
        <b>Key Features of Managed Setup</b>
        <ol>
          <li>
            Customized Configuration Each project is unique, and Panfactum’s
            Managed Setup is designed to reflect that. The configuration process
            includes understanding your specific goals and challenges, which
            allows us to configure the system in a way that matches your needs
            perfectly. From custom rulesets to unique workflows, the setup is
            tailored to your operational demands.
          </li>
          <li>
            Hands-On Guidance and Training As part of the Managed Setup, your
            team receives training and hands-on guidance in Panfactum’s tools
            and workflows. This includes detailed documentation, onboarding
            materials, and workshops aimed at empowering your developers to use
            Panfactum effectively, ensuring they can take full advantage of its
            capabilities.
          </li>
          <li>
            Ongoing Support and Maintenance Post-setup, we provide ongoing
            support, so your team can operate with confidence. Whether it's
            troubleshooting, updates, or scaling the system as your needs grow,
            our experts are always available to assist, ensuring Panfactum
            continues to meet evolving requirements.
          </li>
          <li>
            Accelerated Time to Value By offloading the setup process to
            experts, your team can begin using Panfactum’s advanced features
            much sooner. Instead of spending weeks or months on configurations
            and integrations, the Managed Setup ensures Panfactum is ready for
            use in a fraction of the time, accelerating your project timelines
            and delivering value faster.
          </li>
        </ol>
        <b>Benefits for Your Team</b>
        <p>
          Reduced Complexity: Our team handles the intricate setup details,
          allowing your developers to focus on core project objectives rather
          than learning complex new systems. Improved Efficiency: With
          Panfactum’s Managed Setup, you’ll save time and resources, ensuring
          projects are delivered on time and within budget. Scalability: The
          service sets you up for future growth, enabling you to easily scale
          projects as needed without costly infrastructure changes or
          disruptions.
        </p>
      </>
    ),
  },
  [FeatureName.RoadmapPrioritization]: {
    name: FeatureName.RoadmapPrioritization,
    description: (
      <>
        <p>
          The Managed Setup for Panfactum is a comprehensive service designed to
          accelerate and streamline the implementation of Panfactum for
          developers and organizations looking to harness its full potential. By
          leveraging expert guidance and hands-on support, the Managed Setup
          ensures that every aspect of Panfactum’s deployment is optimized for
          maximum efficiency, allowing teams to focus on innovation rather than
          infrastructure and configuration challenges.
        </p>
        <b>Key Features of Managed Setup</b>
        <ol>
          <li>
            Customized Configuration Each project is unique, and Panfactum’s
            Managed Setup is designed to reflect that. The configuration process
            includes understanding your specific goals and challenges, which
            allows us to configure the system in a way that matches your needs
            perfectly. From custom rulesets to unique workflows, the setup is
            tailored to your operational demands.
          </li>
          <li>
            Hands-On Guidance and Training As part of the Managed Setup, your
            team receives training and hands-on guidance in Panfactum’s tools
            and workflows. This includes detailed documentation, onboarding
            materials, and workshops aimed at empowering your developers to use
            Panfactum effectively, ensuring they can take full advantage of its
            capabilities.
          </li>
          <li>
            Ongoing Support and Maintenance Post-setup, we provide ongoing
            support, so your team can operate with confidence. Whether it's
            troubleshooting, updates, or scaling the system as your needs grow,
            our experts are always available to assist, ensuring Panfactum
            continues to meet evolving requirements.
          </li>
          <li>
            Accelerated Time to Value By offloading the setup process to
            experts, your team can begin using Panfactum’s advanced features
            much sooner. Instead of spending weeks or months on configurations
            and integrations, the Managed Setup ensures Panfactum is ready for
            use in a fraction of the time, accelerating your project timelines
            and delivering value faster.
          </li>
        </ol>
        <b>Benefits for Your Team</b>
        <p>
          Reduced Complexity: Our team handles the intricate setup details,
          allowing your developers to focus on core project objectives rather
          than learning complex new systems. Improved Efficiency: With
          Panfactum’s Managed Setup, you’ll save time and resources, ensuring
          projects are delivered on time and within budget. Scalability: The
          service sets you up for future growth, enabling you to easily scale
          projects as needed without costly infrastructure changes or
          disruptions.
        </p>
      </>
    ),
  },
  [FeatureName.ChatIntegration]: {
    name: FeatureName.ChatIntegration,
    description: (
      <>
        <p>
          The Managed Setup for Panfactum is a comprehensive service designed to
          accelerate and streamline the implementation of Panfactum for
          developers and organizations looking to harness its full potential. By
          leveraging expert guidance and hands-on support, the Managed Setup
          ensures that every aspect of Panfactum’s deployment is optimized for
          maximum efficiency, allowing teams to focus on innovation rather than
          infrastructure and configuration challenges.
        </p>
        <b>Key Features of Managed Setup</b>
        <ol>
          <li>
            Customized Configuration Each project is unique, and Panfactum’s
            Managed Setup is designed to reflect that. The configuration process
            includes understanding your specific goals and challenges, which
            allows us to configure the system in a way that matches your needs
            perfectly. From custom rulesets to unique workflows, the setup is
            tailored to your operational demands.
          </li>
          <li>
            Hands-On Guidance and Training As part of the Managed Setup, your
            team receives training and hands-on guidance in Panfactum’s tools
            and workflows. This includes detailed documentation, onboarding
            materials, and workshops aimed at empowering your developers to use
            Panfactum effectively, ensuring they can take full advantage of its
            capabilities.
          </li>
          <li>
            Ongoing Support and Maintenance Post-setup, we provide ongoing
            support, so your team can operate with confidence. Whether it's
            troubleshooting, updates, or scaling the system as your needs grow,
            our experts are always available to assist, ensuring Panfactum
            continues to meet evolving requirements.
          </li>
          <li>
            Accelerated Time to Value By offloading the setup process to
            experts, your team can begin using Panfactum’s advanced features
            much sooner. Instead of spending weeks or months on configurations
            and integrations, the Managed Setup ensures Panfactum is ready for
            use in a fraction of the time, accelerating your project timelines
            and delivering value faster.
          </li>
        </ol>
        <b>Benefits for Your Team</b>
        <p>
          Reduced Complexity: Our team handles the intricate setup details,
          allowing your developers to focus on core project objectives rather
          than learning complex new systems. Improved Efficiency: With
          Panfactum’s Managed Setup, you’ll save time and resources, ensuring
          projects are delivered on time and within budget. Scalability: The
          service sets you up for future growth, enabling you to easily scale
          projects as needed without costly infrastructure changes or
          disruptions.
        </p>
      </>
    ),
  },
  [FeatureName.BareMetalSupport]: {
    name: FeatureName.BareMetalSupport,
    description: (
      <>
        <p>
          The Managed Setup for Panfactum is a comprehensive service designed to
          accelerate and streamline the implementation of Panfactum for
          developers and organizations looking to harness its full potential. By
          leveraging expert guidance and hands-on support, the Managed Setup
          ensures that every aspect of Panfactum’s deployment is optimized for
          maximum efficiency, allowing teams to focus on innovation rather than
          infrastructure and configuration challenges.
        </p>
        <b>Key Features of Managed Setup</b>
        <ol>
          <li>
            Customized Configuration Each project is unique, and Panfactum’s
            Managed Setup is designed to reflect that. The configuration process
            includes understanding your specific goals and challenges, which
            allows us to configure the system in a way that matches your needs
            perfectly. From custom rulesets to unique workflows, the setup is
            tailored to your operational demands.
          </li>
          <li>
            Hands-On Guidance and Training As part of the Managed Setup, your
            team receives training and hands-on guidance in Panfactum’s tools
            and workflows. This includes detailed documentation, onboarding
            materials, and workshops aimed at empowering your developers to use
            Panfactum effectively, ensuring they can take full advantage of its
            capabilities.
          </li>
          <li>
            Ongoing Support and Maintenance Post-setup, we provide ongoing
            support, so your team can operate with confidence. Whether it's
            troubleshooting, updates, or scaling the system as your needs grow,
            our experts are always available to assist, ensuring Panfactum
            continues to meet evolving requirements.
          </li>
          <li>
            Accelerated Time to Value By offloading the setup process to
            experts, your team can begin using Panfactum’s advanced features
            much sooner. Instead of spending weeks or months on configurations
            and integrations, the Managed Setup ensures Panfactum is ready for
            use in a fraction of the time, accelerating your project timelines
            and delivering value faster.
          </li>
        </ol>
        <b>Benefits for Your Team</b>
        <p>
          Reduced Complexity: Our team handles the intricate setup details,
          allowing your developers to focus on core project objectives rather
          than learning complex new systems. Improved Efficiency: With
          Panfactum’s Managed Setup, you’ll save time and resources, ensuring
          projects are delivered on time and within budget. Scalability: The
          service sets you up for future growth, enabling you to easily scale
          projects as needed without costly infrastructure changes or
          disruptions.
        </p>
      </>
    ),
  },
};

export const plans: Plan[] = [
  {
    name: "Starter",
    price: 1000,
    popular: false,
    description: "Basic Features for up to 10 users",
    features: {
      [FeatureName.Clusters]: {
        feature: features[FeatureName.Clusters],
        name: FeatureName.Clusters,
        included: true,
        qty: {
          included: 1,
          price: 500,
        },
      },
      [FeatureName.ApplicationServices]: {
        feature: features[FeatureName.ApplicationServices],
        name: FeatureName.ApplicationServices,
        included: true,
        qty: {
          included: 2,
          price: 250,
        },
      },
      [FeatureName.Addons]: {
        feature: features[FeatureName.Addons],
        name: FeatureName.Addons,
        included: true,
        qty: {
          included: 3,
          price: 250,
        },
      },
      [FeatureName.ImplementationSupport]: {
        feature: features[FeatureName.ImplementationSupport],
        name: FeatureName.ImplementationSupport,
        included: false,
      },
      [FeatureName.SupportHours]: {
        feature: features[FeatureName.SupportHours],
        name: FeatureName.SupportHours,
        included: true,
        hours: 72,
      },
      [FeatureName.SupportSLA1]: {
        name: FeatureName.SupportSLA1,
        included: true,
        hours: 72,
      },
      [FeatureName.SupportSLA2]: {
        name: FeatureName.SupportSLA2,
        included: true,
        hours: 72,
      },
      [FeatureName.SupportSLA3]: {
        name: FeatureName.SupportSLA3,
        included: true,
        hours: 72,
      },
      [FeatureName.DelegatedSystemAccess]: {
        feature: features[FeatureName.DelegatedSystemAccess],
        name: FeatureName.DelegatedSystemAccess,
        included: false,
      },
      [FeatureName.DedicatedSolutionEngineer]: {
        feature: features[FeatureName.DedicatedSolutionEngineer],
        name: FeatureName.DedicatedSolutionEngineer,
        included: false,
      },
      [FeatureName.Training]: {
        name: FeatureName.Training,
        included: true,
        hours: 72,
      },
      [FeatureName.ManagedSetup]: {
        name: FeatureName.ManagedSetup,
        feature: features[FeatureName.ManagedSetup],
        included: false,
      },
    },
  },

  {
    name: "Growth",
    price: 5000,
    popular: true,
    description: "Basic Features for up to 10 users",
    features: {
      [FeatureName.Clusters]: {
        name: FeatureName.Clusters,
        included: true,
        qty: {
          included: 1,
          price: 500,
        },
      },
      [FeatureName.ApplicationServices]: {
        name: FeatureName.ApplicationServices,
        included: true,
        qty: {
          included: 2,
          price: 250,
        },
      },
      [FeatureName.Addons]: {
        name: FeatureName.Addons,
        included: true,
        qty: {
          included: 3,
          price: 250,
        },
      },
      [FeatureName.ImplementationSupport]: {
        name: FeatureName.ImplementationSupport,
        included: true,
      },
      [FeatureName.SupportHours]: {
        name: FeatureName.SupportHours,
        included: true,
        hours: 72,
      },
      [FeatureName.SupportSLA1]: {
        name: FeatureName.SupportSLA1,
        included: true,
        hours: 72,
      },
      [FeatureName.SupportSLA2]: {
        name: FeatureName.SupportSLA2,
        included: true,
        hours: 72,
      },
      [FeatureName.SupportSLA3]: {
        name: FeatureName.SupportSLA3,
        included: true,
        hours: 72,
      },
      [FeatureName.DelegatedSystemAccess]: {
        feature: features[FeatureName.DelegatedSystemAccess],
        name: FeatureName.DelegatedSystemAccess,
        included: true,
      },
      [FeatureName.DedicatedSolutionEngineer]: {
        feature: features[FeatureName.DedicatedSolutionEngineer],
        name: FeatureName.DedicatedSolutionEngineer,
        included: true,
      },
      [FeatureName.Training]: {
        name: FeatureName.Training,
        included: true,
        hours: 72,
      },
      [FeatureName.ManagedSetup]: {
        name: FeatureName.ManagedSetup,
        feature: features[FeatureName.ManagedSetup],
        included: true,
      },
      [FeatureName.ManagedUpgrades]: {
        name: FeatureName.ManagedUpgrades,
        feature: features[FeatureName.ManagedUpgrades],
        included: true,
      },
      [FeatureName.ActiveMonitoring]: {
        name: FeatureName.ActiveMonitoring,
        feature: features[FeatureName.ActiveMonitoring],
        included: true,
      },
      [FeatureName.PlatformAssessment]: {
        name: FeatureName.PlatformAssessment,
        feature: features[FeatureName.PlatformAssessment],
        included: true,
      },
      [FeatureName.FractionalDevOps]: {
        name: FeatureName.FractionalDevOps,
        feature: features[FeatureName.FractionalDevOps],
        included: true,
      },
      [FeatureName.BAACustomLicense]: {
        name: FeatureName.BAACustomLicense,
        feature: features[FeatureName.BAACustomLicense],
        included: true,
      },
      [FeatureName.StableReleaseAccess]: {
        name: FeatureName.StableReleaseAccess,
        feature: features[FeatureName.StableReleaseAccess],
        included: true,
      },
      [FeatureName.RoadmapPrioritization]: {
        name: FeatureName.RoadmapPrioritization,
        feature: features[FeatureName.RoadmapPrioritization],
        included: true,
      },
      [FeatureName.ChatIntegration]: {
        name: FeatureName.ChatIntegration,
        feature: features[FeatureName.ChatIntegration],
        included: true,
      },
      [FeatureName.BareMetalSupport]: {
        name: FeatureName.BareMetalSupport,
        feature: features[FeatureName.BareMetalSupport],
        included: true,
      },
    },
  },

  {
    name: "Enterprise",
    price: 10000,
    popular: false,
    description: "Basic Features for up to 10 users",
    features: {
      [FeatureName.Clusters]: {
        name: FeatureName.Clusters,
        included: true,
        qty: {
          included: 1,
          price: 500,
        },
      },
      [FeatureName.ApplicationServices]: {
        name: FeatureName.ApplicationServices,
        included: true,
        qty: {
          included: 2,
          price: 250,
        },
      },
      [FeatureName.Addons]: {
        name: FeatureName.Addons,
        included: true,
        qty: {
          included: 3,
          price: 250,
        },
      },
      [FeatureName.ImplementationSupport]: {
        name: FeatureName.ImplementationSupport,
        included: true,
      },
      [FeatureName.SupportHours]: {
        name: FeatureName.SupportHours,
        included: true,
        hours: 72,
      },
      [FeatureName.SupportSLA1]: {
        name: FeatureName.SupportSLA1,
        included: true,
        hours: 1,
      },
      [FeatureName.SupportSLA2]: {
        name: FeatureName.SupportSLA2,
        included: true,
        hours: 1,
      },
      [FeatureName.SupportSLA3]: {
        name: FeatureName.SupportSLA3,
        included: true,
        hours: 1,
      },
      [FeatureName.DelegatedSystemAccess]: {
        feature: features[FeatureName.DelegatedSystemAccess],
        name: FeatureName.DelegatedSystemAccess,
        included: true,
      },
      [FeatureName.DedicatedSolutionEngineer]: {
        feature: features[FeatureName.DedicatedSolutionEngineer],
        name: FeatureName.DedicatedSolutionEngineer,
        included: true,
      },
      [FeatureName.Training]: {
        name: FeatureName.Training,
        included: true,
        hours: 1,
      },
      [FeatureName.ManagedSetup]: {
        name: FeatureName.ManagedSetup,
        feature: features[FeatureName.ManagedSetup],
        included: true,
      },
      [FeatureName.ManagedUpgrades]: {
        name: FeatureName.ManagedUpgrades,
        feature: features[FeatureName.ManagedUpgrades],
        included: true,
      },
      [FeatureName.ActiveMonitoring]: {
        name: FeatureName.ActiveMonitoring,
        feature: features[FeatureName.ActiveMonitoring],
        included: true,
      },
      [FeatureName.PlatformAssessment]: {
        name: FeatureName.PlatformAssessment,
        feature: features[FeatureName.PlatformAssessment],
        included: true,
      },
      [FeatureName.FractionalDevOps]: {
        name: FeatureName.FractionalDevOps,
        feature: features[FeatureName.FractionalDevOps],
        included: true,
      },
      [FeatureName.BAACustomLicense]: {
        name: FeatureName.BAACustomLicense,
        feature: features[FeatureName.BAACustomLicense],
        included: true,
      },
      [FeatureName.StableReleaseAccess]: {
        name: FeatureName.StableReleaseAccess,
        feature: features[FeatureName.StableReleaseAccess],
        included: true,
      },
      [FeatureName.RoadmapPrioritization]: {
        name: FeatureName.RoadmapPrioritization,
        feature: features[FeatureName.RoadmapPrioritization],
        included: true,
      },
      [FeatureName.ChatIntegration]: {
        name: FeatureName.ChatIntegration,
        feature: features[FeatureName.ChatIntegration],
        included: true,
      },
      [FeatureName.BareMetalSupport]: {
        name: FeatureName.BareMetalSupport,
        feature: features[FeatureName.BareMetalSupport],
        included: true,
      },
    },
  },
];

const PlanFeatureMobile = ({
  feature,
  addl,
  onChange,
}: {
  feature: PlanFeature | undefined;
  addl: number;
  onChange: (name: FeatureName, qty: number) => void;
}) => {
  const render =
    !feature || !feature.included ? (
      <FontAwesomeIcon icon={faMinus} />
    ) : feature.qty ? (
      <>
        <PricingTableQty
          qty={feature.qty}
          addl={addl}
          onChange={(qty) => onChange(feature.name, qty)}
        />
      </>
    ) : feature.hours ? (
      `${feature.hours} hours`
    ) : (
      <FontAwesomeIcon icon={faCircleCheck} size={`2xl`} />
    );

  return (
    <>
      <div className="flex self-stretch gap-0 h-[56px] px-container-padding-mobile lg:px-container-padding-desktop">
        <div className="flex w-full self-stretch justify-between gap-x-lg items-center">
          <h3 className="text-sm font-medium">{feature?.name}</h3>
          {render}
        </div>
      </div>
    </>
  );
};

const PlanFeatureDesktop = ({
  feature,
  addl,
  onChange,
}: {
  feature: PlanFeature | undefined;
  addl: number;
  onChange: (name: FeatureName, qty: number) => void;
}) => {
  const render =
    !feature || !feature.included ? (
      <FontAwesomeIcon icon={faMinus} />
    ) : feature.qty ? (
      <>
        <PricingTableQty
          qty={feature.qty}
          addl={addl}
          onChange={(qty) => onChange(feature.name, qty)}
        />
      </>
    ) : feature.hours ? (
      `${feature.hours} hours`
    ) : (
      <FontAwesomeIcon icon={faCircleCheck} size={`xl`} color={`#3B81B0 `} />
    );

  return (
    <>
      <td className={`py-lg px-3xl`}>
        <div className={`flex flex-col gap-y-lg`}>{render}</div>
      </td>
    </>
  );
};

export interface AddlFeatures {
  [planName: string]: { [featureName in FeatureName]?: number };
}

const FeatureDetailsContainer: FC<{
  children: ReactNode;
  isVisible: boolean;
}> = ({ children, isVisible }) => {
  if (!isVisible) {
    return null;
  }

  return (
    <tr>
      <td colSpan={4} className={`w-full p-4 dark:bg-[transparent]`}>
        <div
          className={`bg-secondary_alt p-5xl border border-secondary shadow-sm content dark:bg-[#0C111D]`}
        >
          {children}
        </div>
      </td>
    </tr>
  );
};

export function PricingTable() {
  const [addl, setAddl] = useState<AddlFeatures>({});
  const [expandedFeature, setExpandedFeature] = useState<FeatureName | null>(
    null,
  );
  const toggleFeatureDetails = (featureName: FeatureName) => {
    setExpandedFeature((prev) => (prev === featureName ? null : featureName));
  };

  const onChange = (
    planName: string,
    featureName: FeatureName,
    qty: number,
  ) => {
    if (qty < 0) {
      return;
    }

    setAddl((prev) => ({
      ...prev,
      [planName]: {
        ...prev[planName],
        [featureName]: qty,
      },
    }));
  };

  return (
    <>
      <div className="flex flex-col lg:hidden self-stretch gap-y-6xl">
        {plans.map((plan) => {
          const addlFeatures = addl[plan.name] || {};

          return (
            <div
              key={plan.name}
              className="flex flex-col [&>*:nth-child(even)]:bg-secondary [&>*:nth-child(odd)]:bg-primary"
            >
              <PricingHeader plan={plan} addlFeatures={addlFeatures} />

              {featureOrder.map((name) => {
                const feature = plan.features[name];
                const featureAddl = addl[plan.name]?.[name] || 0;

                if (!feature) {
                  return null;
                }

                return (
                  <PlanFeatureMobile
                    key={plan.name + name}
                    feature={feature}
                    addl={featureAddl}
                    onChange={onChange.bind(null, plan.name)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      <table className="hidden lg:table w-full">
        <thead>
          <tr>
            <th className={`px-3xl w-[304px]`}></th>
            {plans.map((plan) => (
              <th key={plan.name} className={`px-3xl w-[304px]`}>
                <PricingHeader
                  plan={plan}
                  addlFeatures={addl[plan.name] || {}}
                />
              </th>
            ))}
          </tr>
        </thead>

        <tbody
          className={`[&>*:nth-child(odd)]:bg-secondary [&>*:nth-child(even)]:bg-primary text-sm text-tertiary`}
        >
          {featureOrder.map((name) => {
            const feature = features[name];
            const isVisible = expandedFeature === name;

            return (
              <Fragment key={name}>
                <tr className={`text-center h-[64px]`}>
                  <td
                    className={`min-w-[170px] text-start text-primary py-lg px-3xl font-medium whitespace-nowrap`}
                  >
                    <div
                      className={`flex items-center gap-2 ${feature.description ? "cursor-pointer" : ""}`}
                      onClick={() => toggleFeatureDetails(name)}
                    >
                      <span className="text-sm">{name}</span>

                      {feature.description ? (
                        <FontAwesomeIcon
                          className={`w-[12px] h-[12px] transition-transform ${isVisible ? "" : "transform rotate-90"}`}
                          icon={faChevronDown}
                          size={`xs`}
                          color={`#98A8B3`}
                        />
                      ) : null}
                    </div>
                  </td>
                  {plans.map((plan) => {
                    const planFeature = plan.features[name];
                    const featureAddl = addl[plan.name]?.[name] || 0;

                    return (
                      <PlanFeatureDesktop
                        key={plan.name + name}
                        feature={planFeature}
                        addl={featureAddl}
                        onChange={onChange.bind(null, plan.name)}
                      />
                    );
                  })}
                </tr>
                <FeatureDetailsContainer isVisible={isVisible}>
                  {feature.description}
                </FeatureDetailsContainer>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
