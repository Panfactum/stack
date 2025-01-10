import './GridWrapper.css';

const GridWrapper = ({children}) => {
    return <ul className="grid-wrapper">
        {children}
    </ul>
}

export default GridWrapper;