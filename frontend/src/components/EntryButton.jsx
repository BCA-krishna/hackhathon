import styled from 'styled-components';

const StyledWrapper = styled.div`
  .animated-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    width: 100%;
    padding: 14px 28px;
    border: 4px solid;
    border-color: transparent;
    font-size: 14px;
    background-color: #ffffff;
    border-radius: 100px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #1f387e;
    box-shadow: 0 0 0 2px #ffffff;
    cursor: pointer;
    overflow: hidden;
    transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .animated-button svg {
    position: absolute;
    width: 22px;
    fill: #1f387e;
    z-index: 9;
    transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .animated-button .arr-1 {
    right: 16px;
  }

  .animated-button .arr-2 {
    left: -25%;
  }

  .animated-button .circle {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 20px;
    background-color: #c5e5e4;
    border-radius: 50%;
    opacity: 0;
    transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .animated-button .text {
    position: relative;
    z-index: 1;
    transform: translateX(-12px);
    transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .animated-button:hover:not(:disabled) {
    box-shadow: 0 0 0 12px transparent;
    color: #212121;
    border-radius: 12px;
  }

  .animated-button:hover:not(:disabled) .arr-1 {
    right: -25%;
  }

  .animated-button:hover:not(:disabled) .arr-2 {
    left: 16px;
  }

  .animated-button:hover:not(:disabled) .text {
    transform: translateX(12px);
  }

  .animated-button:hover:not(:disabled) .circle {
    width: 220px;
    height: 220px;
    opacity: 1;
  }

  .animated-button:focus-visible {
    outline: 3px solid rgba(59, 130, 246, 0.5);
    outline-offset: 2px;
  }

  .animated-button:active:not(:disabled) {
    scale: 0.97;
    box-shadow: 0 0 0 4px #84cc16;
  }

  .animated-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

export default function EntryButton({ children = 'Get Started', onClick, type = 'button', disabled = false }) {
  return (
    <StyledWrapper>
      <button className="animated-button" onClick={onClick} type={type} disabled={disabled}>
        <svg xmlns="http://www.w3.org/2000/svg" className="arr-2" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z" />
        </svg>
        <span className="text">{children}</span>
        <span className="circle" />
        <svg xmlns="http://www.w3.org/2000/svg" className="arr-1" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z" />
        </svg>
      </button>
    </StyledWrapper>
  );
}
