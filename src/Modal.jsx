import PropTypes from "prop-types";
import "./assets/modal.css";

const Modal = ({ isOpen, onClose, content }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <p className="modal-content">{content}</p>
        <button className="modal-close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired, // Required boolean prop
  onClose: PropTypes.func.isRequired, // Required function prop
  content: PropTypes.string, // Optional string prop
};

export default Modal;
