import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { featureGroups, featureManifest, homeFeatureIds, type FeatureManifestEntry } from '../features/manifest';

function HomeScreen() {
  return (
    <div className="screen-stack">
      <header className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Bento Mobile</span>
          <h1>기존 Bento 전체 기능을 받는 모바일 앱</h1>
          <p>웹 앱을 건드리지 않고, 동일 기능을 모바일 정보구조로 재배치하는 별도 실행 디렉터리입니다.</p>
        </div>
        <div className="hero-card">
          <div className="hero-card-label">Parity Target</div>
          <strong>{featureManifest.length} routes</strong>
          <span>Core + Auth + Admin + System</span>
        </div>
      </header>

      <section className="panel">
        <div className="panel-head">
          <h2>우선 구현할 핵심 흐름</h2>
          <span>모바일 첫 슬라이스</span>
        </div>
        <div className="feature-grid">
          {homeFeatureIds.map((id) => {
            const feature = featureManifest.find((item) => item.id === id);
            if (!feature) return null;
            return <FeatureTile key={feature.id} feature={feature} compact />;
          })}
        </div>
      </section>

      {featureGroups.map((group) => (
        <section className="panel" key={group.key}>
          <div className="panel-head">
            <h2>{group.label}</h2>
            <span>{group.description}</span>
          </div>
          <div className="feature-list">
            {featureManifest
              .filter((feature) => feature.group === group.key)
              .map((feature) => (
                <FeatureTile key={feature.id} feature={feature} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FeatureTile({ feature, compact = false }: { feature: FeatureManifestEntry; compact?: boolean }) {
  return (
    <NavLink className={`feature-card ${compact ? 'compact' : ''}`} to={feature.path}>
      <strong>{feature.title}</strong>
      <p>{feature.summary}</p>
      <span>{feature.api.join(' · ')}</span>
    </NavLink>
  );
}

function FeatureScreen({ feature }: { feature: FeatureManifestEntry }) {
  return (
    <div className="screen-stack">
      <section className="panel feature-hero">
        <div className="panel-head">
          <h2>{feature.title}</h2>
          <span>{feature.path}</span>
        </div>
        <p className="feature-summary">{feature.summary}</p>
        <div className="chips">
          {feature.tags.map((tag) => (
            <span className="chip" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>모바일 처리 목표</h2>
          <span>Product slice</span>
        </div>
        <ul className="bullet-list">
          {feature.mobileGoals.map((goal) => (
            <li key={goal}>{goal}</li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>백엔드 연결 지점</h2>
          <span>SSOT-aware</span>
        </div>
        <ul className="bullet-list mono-list">
          {feature.api.map((api) => (
            <li key={api}>{api}</li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>수용 조건</h2>
          <span>Eval contract</span>
        </div>
        <ul className="bullet-list">
          {feature.acceptance.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function BottomNav() {
  const items = [
    { to: '/', label: '홈' },
    { to: '/files', label: '파일' },
    { to: '/shared', label: '공유' },
    { to: '/search', label: '검색' },
    { to: '/admin', label: '관리' },
  ];

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {items.map((item) => (
        <NavLink key={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} to={item.to} end={item.to === '/'}>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function Header() {
  const location = useLocation();
  return (
    <header className="top-strip">
      <div>
        <strong>Bento Mobile</strong>
        <p>{location.pathname}</p>
      </div>
      <span className="status-pill">Separated from Bento web</span>
    </header>
  );
}

export function AppRouter() {
  return (
    <div className="mobile-app">
      <div className="phone-frame">
        <Header />
        <main className="content">
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            {featureManifest.map((feature) => (
              <Route key={feature.id} path={feature.path} element={<FeatureScreen feature={feature} />} />
            ))}
          </Routes>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
