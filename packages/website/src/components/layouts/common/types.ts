export interface NavLink {
  title: string;
  url: string;
  popup?: boolean;
}

export interface SecondTierConfig {
  logo: {
    src: string;
    alt: string;
    href?: string;
  };
  links: NavLink[];
}
