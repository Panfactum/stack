export function getLastPathSegments(path: string, lastSegments: number){
    return path.split("/").slice(-lastSegments).join("/")
}