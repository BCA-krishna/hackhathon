import styled from 'styled-components';

const featureCards = [
  { title: 'Real-Time Insights', color: '142, 249, 252' },
  { title: 'Demand Forecasting', color: '142, 252, 204' },
  { title: 'Inventory Tracking', color: '142, 252, 157' },
  { title: 'Smart Alerts', color: '215, 252, 142' },
  { title: 'Sales Trends', color: '252, 252, 142' },
  { title: 'KPI Monitoring', color: '252, 208, 142' },
  { title: 'Risk Detection', color: '252, 142, 142' },
  { title: 'Promotion Signals', color: '252, 142, 239' },
  { title: 'Profit Analysis', color: '204, 142, 252' },
  { title: 'AI Recommendations', color: '142, 202, 252' }
];

export default function FeatureShowcase3D() {
  return (
    <StyledWrapper>
      <div className="wrapper">
        <div className="inner" style={{ '--quantity': featureCards.length }}>
          {featureCards.map((feature, idx) => (
            <div key={feature.title} className="card" style={{ '--index': idx, '--color-card': feature.color }}>
              <div className="img" />
              <div className="label">{feature.title}</div>
            </div>
          ))}
        </div>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.section`
  position: relative;
  width: 100%;
  height: 260px;

  .wrapper {
    width: 100%;
    height: 100%;
    position: relative;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: 20px;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: radial-gradient(circle at top, rgba(15, 23, 42, 0.75), rgba(2, 6, 23, 0.95));
  }

  .inner {
    --w: 130px;
    --h: 170px;
    --translateZ: calc((var(--w) + var(--h)) - 30px);
    --rotateX: -12deg;
    --perspective: 1000px;
    position: absolute;
    width: var(--w);
    height: var(--h);
    top: 18%;
    left: calc(50% - (var(--w) / 2));
    z-index: 2;
    transform-style: preserve-3d;
    transform: perspective(var(--perspective));
    animation: rotating 22s linear infinite;
  }

  @keyframes rotating {
    from {
      transform: perspective(var(--perspective)) rotateX(var(--rotateX)) rotateY(0deg);
    }
    to {
      transform: perspective(var(--perspective)) rotateX(var(--rotateX)) rotateY(360deg);
    }
  }

  .card {
    position: absolute;
    border: 2px solid rgba(var(--color-card), 0.95);
    border-radius: 14px;
    overflow: hidden;
    inset: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    transform: rotateY(calc((360deg / var(--quantity)) * var(--index))) translateZ(var(--translateZ));
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
  }

  .img {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle,
      rgba(var(--color-card), 0.2) 0%,
      rgba(var(--color-card), 0.62) 80%,
      rgba(var(--color-card), 0.92) 100%
    );
  }

  .label {
    position: relative;
    z-index: 1;
    margin: 0 8px 10px;
    padding: 6px 8px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: white;
    background: rgba(2, 6, 23, 0.45);
    backdrop-filter: blur(4px);
  }

  @media (max-width: 768px) {
    height: 220px;

    .inner {
      --w: 98px;
      --h: 140px;
      --translateZ: calc((var(--w) + var(--h)) - 35px);
      top: 16%;
    }

    .label {
      font-size: 10px;
    }
  }
`;
