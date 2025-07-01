import { z } from "zod";

export const AWS_SECRET_KEY_SCHEMA = z.string().regex(
    /^[A-Za-z0-9/+=]{40}$/,
    "Invalid AWS Secret Access Key. AWS Secret Access Keys are 40 characters long and contain only alphanumeric characters, forward slashes, plus signs and equals signs."
);

export const AWS_ACCESS_KEY_ID_SCHEMA = z.string().regex(
    /^AKIA[A-Z0-9]{16}$/,
    "Invalid AWS Access Key ID. AWS Access Key IDs are 20 characters and start with 'AKIA'"
)

export const AWS_REGIONS = [
    "us-east-1",
    "us-east-2",
    // "us-west-1", Not possible to run 3 azs in this region which means SLA 3 is unavailable
    "us-west-2",
    // "af-south-1", Something is wrong with S3 in this region and it breaks the installer
    "ap-east-1",
    "ap-south-1",
    "ap-south-2",
    "ap-southeast-1",
    "ap-southeast-2",
    "ap-southeast-3",
    "ap-southeast-4",
    "ap-northeast-1",
    "ap-northeast-2",
    "ap-northeast-3",
    "ca-central-1",
    "ca-west-1",
    "eu-central-1",
    "eu-central-2",
    "eu-west-1",
    "eu-west-2",
    "eu-west-3",
    "eu-south-1",
    "eu-south-2",
    "eu-north-1",
    "il-central-1",
    "me-south-1",
    "me-central-1",
    "sa-east-1",
    //"us-gov-east-1", Has restrictions on services that we haven't tested for compatibility with the framework
    //"us-gov-west-1",
] as const;

export const AWS_REGION_SCHEMA = z
    .string()
    .refine((region) => (AWS_REGIONS as readonly string[]).includes(region), {
        message: "Not a valid AWS region",
    })
    .optional();

export const AWS_ACCOUNT_ID_SCHEMA = z
    .string()
    .regex(/^\d{12}$/, "AWS Account ID must be exactly 12 digits");

export const ECR_REGISTRY_SCHEMA = z
    .string()
    .regex(/^\d{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com$/, "Invalid ECR registry format. Expected: accountId.dkr.ecr.region.amazonaws.com");


export const BUCKET_NAME_SCHEMA = z.string()
    .max(63, "S3 bucket names must be less than 64 characters long")
    .min(3, "S3 bucket names must be at least three characters")
    .regex(/^[a-z0-9][a-z0-9.-]+[a-z0-9]$/, "S3 bucket names can only contain lowercase letters, numbers, periods, and hyphens, and must begin and end with a letter or number")
    .refine(val => !val.includes(".."), "S3 bucket names must not contain adjacent periods")
    .refine(val => !val.endsWith("-s3alias") && !val.endsWith("--ol-s3") && !val.endsWith(".mrap") && !val.endsWith("--x-s3") && !val.endsWith("--table-s3"), "S3 bucket names must not end with any of: -s3alias, --ol-s3, .mrap, --x-s3, --table-s3")
    .refine(val => !val.startsWith("xn--") && !val.startsWith("sthree-") && !val.startsWith("amzn-s3-demo-"), "S3 bucket names must not start with any of: xn--, sthree-, amzn-s3-demo-")
    .refine(val => {
        // Check if the bucket name is formatted like an IP address
        const ipv4Regex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
        return !ipv4Regex.test(val);
    }, "S3 bucket names must not be formatted as IP addresses")

export const AWS_PHONE_NUMBER_SCHEMA = z
    .string()
    .regex(/^\+\d{1,3} \d{1,4}-\d{1,4}-[\d-]{4,20}$/, "Phone numbers must be in the format +[country dialing code] [area code]-[exchange-code]-[local-code], e.g., +1 555-555-5555")

export const AWS_ACCOUNT_ALIAS_SCHEMA = z
    .string()
    .min(3, "Account names/aliases must be at least three characters")
    .max(32, "Account names/aliases must be no longer than 32 characters")
    .regex(/^[a-z0-9-]+$/, "Account names/aliases can only contain lowercase letters, numbers, and hyphens")
    .refine(val => !val.includes('--'), "Account names/aliases cannot contain consecutive hyphens")
    .refine(val => !val.startsWith('-') && !val.endsWith('-'), "Account names/aliases cannot start or end with a hyphen")
    .refine(val => !/^\d{12}$/.test(val), "Account names/aliases cannot be a 12-digit number")

// AWS CLI and kubectl output validation schemas
// Used across multiple k8s cluster commands to ensure consistency and reduce duplication

// AWS EKS describe-cluster response schema
export const EKS_DESCRIBE_CLUSTER_SCHEMA = z.object({
  cluster: z.object({
    name: z.string(),
    arn: z.string(),
    status: z.string(),
    version: z.string(),
    endpoint: z.string(),
    certificateAuthority: z.object({
      data: z.string()
    }),
    tags: z.record(z.string()).optional()
  })
})

// AWS EKS list-nodegroups response schema
export const EKS_LIST_NODEGROUPS_SCHEMA = z.object({
  nodegroups: z.array(z.string()).optional()
})

// Kubernetes resources list schema (kubectl get -o json)
export const KUBERNETES_ITEMS_SCHEMA = z.object({
  items: z.array(z.object({
    metadata: z.object({
      name: z.string()
    })
  })).optional()
})

export const CERTIFICATE_ITEMS_SCHEMA = z.object({
  items: z.array(z.object({
    metadata: z.object({
      name: z.string(),
      namespace: z.string()
    }),
    spec: z.object({
      issuerRef: z.object({
        name: z.string()
      }).optional()
    }).optional()
  })).optional()
})

// AWS Auto Scaling Groups with tags (for resume operations)
export const AUTO_SCALING_GROUPS_WITH_TAGS_SCHEMA = z.array(z.object({
  AutoScalingGroupName: z.string(),
  Tags: z.array(z.object({
    Key: z.string(),
    Value: z.string()
  }))
}))

// AWS Auto Scaling Groups with sizing info (for suspend operations)
export const AUTO_SCALING_GROUPS_WITH_SIZING_SCHEMA = z.array(z.object({
  AutoScalingGroupName: z.string(),
  MinSize: z.number(),
  MaxSize: z.number(),
  DesiredCapacity: z.number()
}))

// AWS EC2 instances query response (nested arrays from Reservations[*].Instances[*].InstanceId)
export const EC2_INSTANCES_SCHEMA = z.array(z.array(z.string()))

// AWS ELBv2 load balancers response schema
export const LOAD_BALANCERS_SCHEMA = z.array(z.object({
  LoadBalancerArn: z.string()
}))

export const COUNTRY_CODES = [
    { value: 'US', name: 'United States (US)' },
    { value: 'AF', name: 'Afghanistan (AF)' },
    { value: 'AX', name: 'Åland Islands (AX)' },
    { value: 'AL', name: 'Albania (AL)' },
    { value: 'DZ', name: 'Algeria (DZ)' },
    { value: 'AS', name: 'American Samoa (AS)' },
    { value: 'AD', name: 'Andorra (AD)' },
    { value: 'AO', name: 'Angola (AO)' },
    { value: 'AI', name: 'Anguilla (AI)' },
    { value: 'AQ', name: 'Antarctica (AQ)' },
    { value: 'AG', name: 'Antigua and Barbuda (AG)' },
    { value: 'AR', name: 'Argentina (AR)' },
    { value: 'AM', name: 'Armenia (AM)' },
    { value: 'AW', name: 'Aruba (AW)' },
    { value: 'AU', name: 'Australia (AU)' },
    { value: 'AT', name: 'Austria (AT)' },
    { value: 'AZ', name: 'Azerbaijan (AZ)' },
    { value: 'BS', name: 'Bahamas (BS)' },
    { value: 'BH', name: 'Bahrain (BH)' },
    { value: 'BD', name: 'Bangladesh (BD)' },
    { value: 'BB', name: 'Barbados (BB)' },
    { value: 'BY', name: 'Belarus (BY)' },
    { value: 'BE', name: 'Belgium (BE)' },
    { value: 'BZ', name: 'Belize (BZ)' },
    { value: 'BJ', name: 'Benin (BJ)' },
    { value: 'BM', name: 'Bermuda (BM)' },
    { value: 'BT', name: 'Bhutan (BT)' },
    { value: 'BO', name: 'Bolivia (BO)' },
    { value: 'BQ', name: 'Bonaire, Sint Eustatius and Saba (BQ)' },
    { value: 'BA', name: 'Bosnia and Herzegovina (BA)' },
    { value: 'BW', name: 'Botswana (BW)' },
    { value: 'BV', name: 'Bouvet Island (BV)' },
    { value: 'BR', name: 'Brazil (BR)' },
    { value: 'IO', name: 'British Indian Ocean Territory (IO)' },
    { value: 'BN', name: 'Brunei Darussalam (BN)' },
    { value: 'BG', name: 'Bulgaria (BG)' },
    { value: 'BF', name: 'Burkina Faso (BF)' },
    { value: 'BI', name: 'Burundi (BI)' },
    { value: 'CV', name: 'Cabo Verde (CV)' },
    { value: 'KH', name: 'Cambodia (KH)' },
    { value: 'CM', name: 'Cameroon (CM)' },
    { value: 'CA', name: 'Canada (CA)' },
    { value: 'KY', name: 'Cayman Islands (KY)' },
    { value: 'CF', name: 'Central African Republic (CF)' },
    { value: 'TD', name: 'Chad (TD)' },
    { value: 'CL', name: 'Chile (CL)' },
    { value: 'CN', name: 'China (CN)' },
    { value: 'CX', name: 'Christmas Island (CX)' },
    { value: 'CC', name: 'Cocos (Keeling) Islands (CC)' },
    { value: 'CO', name: 'Colombia (CO)' },
    { value: 'KM', name: 'Comoros (KM)' },
    { value: 'CG', name: 'Congo (CG)' },
    { value: 'CD', name: 'Congo, Democratic Republic of the (CD)' },
    { value: 'CK', name: 'Cook Islands (CK)' },
    { value: 'CR', name: 'Costa Rica (CR)' },
    { value: 'CI', name: 'Côte d\'Ivoire (CI)' },
    { value: 'HR', name: 'Croatia (HR)' },
    { value: 'CU', name: 'Cuba (CU)' },
    { value: 'CW', name: 'Curaçao (CW)' },
    { value: 'CY', name: 'Cyprus (CY)' },
    { value: 'CZ', name: 'Czechia (CZ)' },
    { value: 'DK', name: 'Denmark (DK)' },
    { value: 'DJ', name: 'Djibouti (DJ)' },
    { value: 'DM', name: 'Dominica (DM)' },
    { value: 'DO', name: 'Dominican Republic (DO)' },
    { value: 'EC', name: 'Ecuador (EC)' },
    { value: 'EG', name: 'Egypt (EG)' },
    { value: 'SV', name: 'El Salvador (SV)' },
    { value: 'GQ', name: 'Equatorial Guinea (GQ)' },
    { value: 'ER', name: 'Eritrea (ER)' },
    { value: 'EE', name: 'Estonia (EE)' },
    { value: 'SZ', name: 'Eswatini (SZ)' },
    { value: 'ET', name: 'Ethiopia (ET)' },
    { value: 'FK', name: 'Falkland Islands (FK)' },
    { value: 'FO', name: 'Faroe Islands (FO)' },
    { value: 'FJ', name: 'Fiji (FJ)' },
    { value: 'FI', name: 'Finland (FI)' },
    { value: 'FR', name: 'France (FR)' },
    { value: 'GF', name: 'French Guiana (GF)' },
    { value: 'PF', name: 'French Polynesia (PF)' },
    { value: 'TF', name: 'French Southern Territories (TF)' },
    { value: 'GA', name: 'Gabon (GA)' },
    { value: 'GM', name: 'Gambia (GM)' },
    { value: 'GE', name: 'Georgia (GE)' },
    { value: 'DE', name: 'Germany (DE)' },
    { value: 'GH', name: 'Ghana (GH)' },
    { value: 'GI', name: 'Gibraltar (GI)' },
    { value: 'GR', name: 'Greece (GR)' },
    { value: 'GL', name: 'Greenland (GL)' },
    { value: 'GD', name: 'Grenada (GD)' },
    { value: 'GP', name: 'Guadeloupe (GP)' },
    { value: 'GU', name: 'Guam (GU)' },
    { value: 'GT', name: 'Guatemala (GT)' },
    { value: 'GG', name: 'Guernsey (GG)' },
    { value: 'GN', name: 'Guinea (GN)' },
    { value: 'GW', name: 'Guinea-Bissau (GW)' },
    { value: 'GY', name: 'Guyana (GY)' },
    { value: 'HT', name: 'Haiti (HT)' },
    { value: 'HM', name: 'Heard Island and McDonald Islands (HM)' },
    { value: 'VA', name: 'Holy See (VA)' },
    { value: 'HN', name: 'Honduras (HN)' },
    { value: 'HK', name: 'Hong Kong (HK)' },
    { value: 'HU', name: 'Hungary (HU)' },
    { value: 'IS', name: 'Iceland (IS)' },
    { value: 'IN', name: 'India (IN)' },
    { value: 'ID', name: 'Indonesia (ID)' },
    { value: 'IR', name: 'Iran (IR)' },
    { value: 'IQ', name: 'Iraq (IQ)' },
    { value: 'IE', name: 'Ireland (IE)' },
    { value: 'IM', name: 'Isle of Man (IM)' },
    { value: 'IL', name: 'Israel (IL)' },
    { value: 'IT', name: 'Italy (IT)' },
    { value: 'JM', name: 'Jamaica (JM)' },
    { value: 'JP', name: 'Japan (JP)' },
    { value: 'JE', name: 'Jersey (JE)' },
    { value: 'JO', name: 'Jordan (JO)' },
    { value: 'KZ', name: 'Kazakhstan (KZ)' },
    { value: 'KE', name: 'Kenya (KE)' },
    { value: 'KI', name: 'Kiribati (KI)' },
    { value: 'KP', name: 'Korea, Democratic People\'s Republic of (KP)' },
    { value: 'KR', name: 'Korea, Republic of (KR)' },
    { value: 'KW', name: 'Kuwait (KW)' },
    { value: 'KG', name: 'Kyrgyzstan (KG)' },
    { value: 'LA', name: 'Lao People\'s Democratic Republic (LA)' },
    { value: 'LV', name: 'Latvia (LV)' },
    { value: 'LB', name: 'Lebanon (LB)' },
    { value: 'LS', name: 'Lesotho (LS)' },
    { value: 'LR', name: 'Liberia (LR)' },
    { value: 'LY', name: 'Libya (LY)' },
    { value: 'LI', name: 'Liechtenstein (LI)' },
    { value: 'LT', name: 'Lithuania (LT)' },
    { value: 'LU', name: 'Luxembourg (LU)' },
    { value: 'MO', name: 'Macao (MO)' },
    { value: 'MG', name: 'Madagascar (MG)' },
    { value: 'MW', name: 'Malawi (MW)' },
    { value: 'MY', name: 'Malaysia (MY)' },
    { value: 'MV', name: 'Maldives (MV)' },
    { value: 'ML', name: 'Mali (ML)' },
    { value: 'MT', name: 'Malta (MT)' },
    { value: 'MH', name: 'Marshall Islands (MH)' },
    { value: 'MQ', name: 'Martinique (MQ)' },
    { value: 'MR', name: 'Mauritania (MR)' },
    { value: 'MU', name: 'Mauritius (MU)' },
    { value: 'YT', name: 'Mayotte (YT)' },
    { value: 'MX', name: 'Mexico (MX)' },
    { value: 'FM', name: 'Micronesia (FM)' },
    { value: 'MD', name: 'Moldova (MD)' },
    { value: 'MC', name: 'Monaco (MC)' },
    { value: 'MN', name: 'Mongolia (MN)' },
    { value: 'ME', name: 'Montenegro (ME)' },
    { value: 'MS', name: 'Montserrat (MS)' },
    { value: 'MA', name: 'Morocco (MA)' },
    { value: 'MZ', name: 'Mozambique (MZ)' },
    { value: 'MM', name: 'Myanmar (MM)' },
    { value: 'NA', name: 'Namibia (NA)' },
    { value: 'NR', name: 'Nauru (NR)' },
    { value: 'NP', name: 'Nepal (NP)' },
    { value: 'NL', name: 'Netherlands (NL)' },
    { value: 'NC', name: 'New Caledonia (NC)' },
    { value: 'NZ', name: 'New Zealand (NZ)' },
    { value: 'NI', name: 'Nicaragua (NI)' },
    { value: 'NE', name: 'Niger (NE)' },
    { value: 'NG', name: 'Nigeria (NG)' },
    { value: 'NU', name: 'Niue (NU)' },
    { value: 'NF', name: 'Norfolk Island (NF)' },
    { value: 'MK', name: 'North Macedonia (MK)' },
    { value: 'MP', name: 'Northern Mariana Islands (MP)' },
    { value: 'NO', name: 'Norway (NO)' },
    { value: 'OM', name: 'Oman (OM)' },
    { value: 'PK', name: 'Pakistan (PK)' },
    { value: 'PW', name: 'Palau (PW)' },
    { value: 'PS', name: 'Palestine, State of (PS)' },
    { value: 'PA', name: 'Panama (PA)' },
    { value: 'PG', name: 'Papua New Guinea (PG)' },
    { value: 'PY', name: 'Paraguay (PY)' },
    { value: 'PE', name: 'Peru (PE)' },
    { value: 'PH', name: 'Philippines (PH)' },
    { value: 'PN', name: 'Pitcairn (PN)' },
    { value: 'PL', name: 'Poland (PL)' },
    { value: 'PT', name: 'Portugal (PT)' },
    { value: 'PR', name: 'Puerto Rico (PR)' },
    { value: 'QA', name: 'Qatar (QA)' },
    { value: 'RE', name: 'Réunion (RE)' },
    { value: 'RO', name: 'Romania (RO)' },
    { value: 'RU', name: 'Russian Federation (RU)' },
    { value: 'RW', name: 'Rwanda (RW)' },
    { value: 'BL', name: 'Saint Barthélemy (BL)' },
    { value: 'SH', name: 'Saint Helena, Ascension and Tristan da Cunha (SH)' },
    { value: 'KN', name: 'Saint Kitts and Nevis (KN)' },
    { value: 'LC', name: 'Saint Lucia (LC)' },
    { value: 'MF', name: 'Saint Martin (French part) (MF)' },
    { value: 'PM', name: 'Saint Pierre and Miquelon (PM)' },
    { value: 'VC', name: 'Saint Vincent and the Grenadines (VC)' },
    { value: 'WS', name: 'Samoa (WS)' },
    { value: 'SM', name: 'San Marino (SM)' },
    { value: 'ST', name: 'Sao Tome and Principe (ST)' },
    { value: 'SA', name: 'Saudi Arabia (SA)' },
    { value: 'SN', name: 'Senegal (SN)' },
    { value: 'RS', name: 'Serbia (RS)' },
    { value: 'SC', name: 'Seychelles (SC)' },
    { value: 'SL', name: 'Sierra Leone (SL)' },
    { value: 'SG', name: 'Singapore (SG)' },
    { value: 'SX', name: 'Sint Maarten (Dutch part) (SX)' },
    { value: 'SK', name: 'Slovakia (SK)' },
    { value: 'SI', name: 'Slovenia (SI)' },
    { value: 'SB', name: 'Solomon Islands (SB)' },
    { value: 'SO', name: 'Somalia (SO)' },
    { value: 'ZA', name: 'South Africa (ZA)' },
    { value: 'GS', name: 'South Georgia and the South Sandwich Islands (GS)' },
    { value: 'SS', name: 'South Sudan (SS)' },
    { value: 'ES', name: 'Spain (ES)' },
    { value: 'LK', name: 'Sri Lanka (LK)' },
    { value: 'SD', name: 'Sudan (SD)' },
    { value: 'SR', name: 'Suriname (SR)' },
    { value: 'SJ', name: 'Svalbard and Jan Mayen (SJ)' },
    { value: 'SE', name: 'Sweden (SE)' },
    { value: 'CH', name: 'Switzerland (CH)' },
    { value: 'SY', name: 'Syrian Arab Republic (SY)' },
    { value: 'TW', name: 'Taiwan (TW)' },
    { value: 'TJ', name: 'Tajikistan (TJ)' },
    { value: 'TZ', name: 'Tanzania (TZ)' },
    { value: 'TH', name: 'Thailand (TH)' },
    { value: 'TL', name: 'Timor-Leste (TL)' },
    { value: 'TG', name: 'Togo (TG)' },
    { value: 'TK', name: 'Tokelau (TK)' },
    { value: 'TO', name: 'Tonga (TO)' },
    { value: 'TT', name: 'Trinidad and Tobago (TT)' },
    { value: 'TN', name: 'Tunisia (TN)' },
    { value: 'TR', name: 'Turkey (TR)' },
    { value: 'TM', name: 'Turkmenistan (TM)' },
    { value: 'TC', name: 'Turks and Caicos Islands (TC)' },
    { value: 'TV', name: 'Tuvalu (TV)' },
    { value: 'UG', name: 'Uganda (UG)' },
    { value: 'UA', name: 'Ukraine (UA)' },
    { value: 'AE', name: 'United Arab Emirates (AE)' },
    { value: 'GB', name: 'United Kingdom (GB)' },
    { value: 'UM', name: 'United States Minor Outlying Islands (UM)' },
    { value: 'UY', name: 'Uruguay (UY)' },
    { value: 'UZ', name: 'Uzbekistan (UZ)' },
    { value: 'VU', name: 'Vanuatu (VU)' },
    { value: 'VE', name: 'Venezuela (VE)' },
    { value: 'VN', name: 'Viet Nam (VN)' },
    { value: 'VG', name: 'Virgin Islands, British (VG)' },
    { value: 'VI', name: 'Virgin Islands, U.S. (VI)' },
    { value: 'WF', name: 'Wallis and Futuna (WF)' },
    { value: 'EH', name: 'Western Sahara (EH)' },
    { value: 'YE', name: 'Yemen (YE)' },
    { value: 'ZM', name: 'Zambia (ZM)' },
    { value: 'ZW', name: 'Zimbabwe (ZW)' }
]