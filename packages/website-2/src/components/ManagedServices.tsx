import VariableSizeMasonry from "./DndGrid/VariableSizeMasonry";

export default function ManagedServices({ children }): React.ReactNode {
  return (
    <div className="managed-services max-w-[1280px] w-full">{children}</div>
  );
}
