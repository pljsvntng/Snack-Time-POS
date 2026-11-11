export default function PageHeader({ eyebrow = 'Your workspace', title, description, children }) {
  return <header className="page-header">
    <div className="page-heading"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{description && <p className="page-description">{description}</p>}</div>
    {children && <div className="page-header-actions">{children}</div>}
  </header>;
}
