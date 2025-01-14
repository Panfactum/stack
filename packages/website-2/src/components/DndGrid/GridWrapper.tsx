import "./GridWrapper.css";

const GridWrapper = ({ children }) => {
  return (
    <ul
      className={`
        grid-wrapper 
        max-w-none md:max-w-3xl w-full 
        grid grid-cols-3 
        justify-center justify-items-center items-center
    `}
    >
      {children}
    </ul>
  );
};

export default GridWrapper;
