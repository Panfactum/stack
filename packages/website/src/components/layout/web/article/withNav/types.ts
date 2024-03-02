export interface IArticleNavLinkProps {
  text: string;
  path: string;
  sub?: undefined;

}
export interface IArticleNavSectionProps {
  text: string;
  path: string;
  sub: Array<IArticleNavSectionProps | IArticleNavLinkProps>
}
export interface ITreeProps {
  basePath: string
  depth: number
  onNavigate?: () => void
}
export interface IArticleNavProps {
  sections: Array<IArticleNavSectionProps | IArticleNavLinkProps>
  basePath: string
  onNavigate?: () => void
}
