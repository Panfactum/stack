import pc from "picocolors"

type ColorStyle = "default" | "warning" | "important" | "question" | "error" | "success" | "subtle"

export function applyColors(str: string, config: {
    style?: ColorStyle
    bold?: boolean,
    highlights?: string[] | Array<{
        phrase: string,
        style: ColorStyle
    }>
}){
    const {style = "default", bold, highlights} = config

    let resultStr = getColorFn(style)(str)
    if(bold){
        resultStr = pc.bold(resultStr)
    }

    for (const highlight of highlights ?? []){

        // This is not the most performant, but is fine for a few lines of text
        // This weird split/join logic is necessary to prevent the highlights from
        // resetting the base string style
        if(typeof highlight === "string"){
            resultStr = resultStr.split(highlight)
            .map(sub => getColorFn(style)(sub))
            .join(pc.blue(highlight))
        } else {
            resultStr = resultStr
                .split(highlight.phrase)
                .map(sub => getColorFn(style)(sub))
                .join(getColorFn(highlight.style)(highlight.phrase))
        }
    }
 
    return resultStr;
}


function getColorFn(style: ColorStyle){

    switch(style){
        case "error": {
            return pc.red
        }
        case "warning": {
            return pc.yellow
        }
        case "important": {
            return pc.blue
        }
        case "success": {
            return pc.greenBright
        }
        case "default": {
            return pc.white
        }
        case "subtle": {
            return pc.gray
        }
        case "question": {
            return pc.magenta
        }
    }
}