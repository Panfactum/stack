import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "./SortableItem.css";

const SortableItem = ({
  id,
  className,
  content,
  isExpanded = false,
  onClick,
  ...props
}: {
  id: number;
  className?: string;
  content: {
    id: number;
    icon: string;
    title: string;
    category: string;
    content: string;
    avg_savings: number;
  };
  isExpanded: boolean;
  onClick: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      className={`relative grid-item border border-primary ${isExpanded ? "is-expanded p-6 bg-primary" : "flex items-center justify-center bg-white"} ${className}`}
      id={`grid-item-${content.id}`}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      {isExpanded && (
        <div className="flex items-start gap-6">
          <div className="flex-none p-4 bg-white border border-primary w-fit rounded-md">
            <img
              src={`/${content.icon}`}
              className="w-[58px] h-[58px]"
              alt={`move-icon-${content.id}`}
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary mb-2">
              {content.title}
            </p>
            <div className="text-sm py-1 px-2 bg-utility-blue-50 w-fit rounded-md border border-utility-blue-200 text-utility-blue-700 font-medium mb-4">
              {content.category}
            </div>
            <p className="text-sm text-primary mb-4 line-clamp-6">
              {content.content}
            </p>
            <p className="text-md">
              Average Savings: <strong>${content.avg_savings}/mo</strong>
            </p>
          </div>
        </div>
      )}

      {!isExpanded && (
        <img
          src={`/${content.icon}`}
          alt={`move-icon-${content.id}`}
          className="absolute z-[401] cursor-pointer"
          onClick={onClick}
        />
      )}
    </li>
  );
};

export default SortableItem;
