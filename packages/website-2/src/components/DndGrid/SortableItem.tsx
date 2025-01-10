import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import './SortableItem.css';

const SortableItem = ({ className, onClick, ...props }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition
  } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <li
      className={`grid-item ${className}`}
      id={`grid-item-${props.id}`}
      ref={setNodeRef}
      style={style}
      onClick={onClick}
    >
      <div>Tile {props.id}</div>
    </li>
  );
};

export default SortableItem;
