import styled from 'styled-components';

const Wrapper = styled.div`
  display: inline-block;
  perspective: 1000px;
`;

const StyledButton = styled.button`
  position: relative;
  border: none;
  outline: none;
  padding: 0.8em 1.5em;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #ffffff;
  background: linear-gradient(${(props) => props.$color1}, ${(props) => props.$color2});
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  cursor: pointer;
  transform: rotateX(16deg) rotateZ(-4deg);
  transform-style: preserve-3d;
  transition: transform 0.25s ease, filter 0.25s ease, opacity 0.25s ease;
  will-change: transform;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    bottom: -10px;
    width: 100%;
    height: 10px;
    border-radius: 0 0 10px 10px;
    background: ${(props) => props.$color2};
    transform: rotateX(90deg);
    transform-origin: bottom;
    filter: brightness(0.85);
  }

  &::after {
    content: '';
    position: absolute;
    top: 0;
    right: -10px;
    width: 10px;
    height: 100%;
    border-radius: 0 10px 10px 0;
    background: ${(props) => props.$color1};
    transform: rotateY(-90deg);
    transform-origin: right;
    filter: brightness(0.9);
  }

  &:hover:not(:disabled) {
    transform: rotateX(8deg) rotateZ(0deg) translateY(-1px);
    filter: brightness(1.05);
  }

  &:active:not(:disabled) {
    transform: rotateX(4deg) rotateZ(0deg) translateY(1px);
  }

  &:focus-visible {
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.2), 0 0 0 6px rgba(37, 99, 235, 0.35);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
    transform: rotateX(8deg) rotateZ(0deg);
  }
`;

export default function Button3D({
  children,
  onClick,
  type = 'button',
  color1 = '#2563eb',
  color2 = '#1e40af',
  disabled = false,
  className,
  ariaLabel
}) {
  return (
    <Wrapper className={className}>
      <StyledButton
        type={type}
        onClick={onClick}
        $color1={color1}
        $color2={color2}
        disabled={disabled}
        aria-label={ariaLabel}
      >
        {children}
      </StyledButton>
    </Wrapper>
  );
}
