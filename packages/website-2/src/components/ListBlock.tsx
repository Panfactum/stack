import {
  chatBubble,
  thunderBolt,
  barBreak,
  chatHappy,
  ownership,
  messageHeart,
  shield,
  dollar,
  power,
  database,
  code,
  ciCd,
  eye,
  qrCode,
  flag,
} from '@/components/ReactIcons'

const getIcon = (type: string): React.ReactNode => {
  switch (type) {
    case 'chat-bubble':
      return chatBubble()
    case 'thunder-bolt':
      return thunderBolt()
    case 'bar-chart-break':
      return barBreak()
    case 'chat-happy':
      return chatHappy()
    case 'ownership':
      return ownership()
    case 'message-heart':
      return messageHeart()
    case 'shield': return shield()
    case 'dollar': return dollar()
    case 'power': return power()
    case 'database': return database()
    case 'code': return code()
    case 'ci-cd': return ciCd()
    case 'eye': return eye()
    case 'qrCode': return qrCode()
    case 'flag': return flag()
  }
}

type ListBlockProps = {
    icon: string;
    title: string;
    content: string;
}

export function ListBlock({ icon, title, content}: ListBlockProps) {
    return (
        <div className="flex flex-col items-center gap-xl text-center">
            <div className="w-[48px] h-[48px] flex items-center justify-center rounded-md shadow-sm py-[10px] whitespace-nowrap focus-visible:outline-none focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none button-bg-primary button-text-primary border-2 button-border-primary">
              {getIcon(icon)}
            </div>

            <h3 className="text-primary_on-brand text-xl font-semibold">
              {title}
            </h3>
            <p className="text-tertiary_on-brand text-md max-w-[384px] w-full">
              {content}
            </p>
          </div>
    )
}

export function FeatureListBlock({ icon, title, content }: ListBlockProps) {
    return (<div className="flex flex-col items-center gap-xl text-center max-w-[384px]">
            <div className="w-[48px] h-[48px] flex items-center justify-center border border-[#e4e9ec] rounded-md p-[14px] shadow bg-primary dark:bg-primary dark:border-[#333741]">
              {getIcon(icon)}
            </div>

            <h3 className="text-primary text-lg md:text-xl font-semibold">
              {title}
            </h3>
            <p className="text-tertiary text-md max-w-[378px]">{content}</p>
          </div>)
}