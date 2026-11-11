import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '../services/api';
import Toast from '../components/Toast';
import PageHeader from '../components/PageHeader';
import { BrandMark } from '../components/Brand';

export default function Settings() {
  const [form, setForm] = useState({});
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/settings').then(setForm).catch((err) => setToast({ type: 'error', message: err.message })).finally(() => setLoading(false));
  }, []);

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.put('/settings', form);
      setToast({ type: 'success', message: 'Settings saved.' });
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  if (loading) return <div className="empty-state">Loading settings...</div>;

  return (
    <div>
      <PageHeader title="Business settings" description="The details that make every receipt yours." />

      <div className="settings-layout">
      <div className="card settings-form-card">
        <div className="section-heading"><h3>Shop & receipt details</h3><p>Keep your business information up to date.</p></div>
        <form onSubmit={handleSave}>
          <div className="form-grid">
          <div className="form-group">
            <label htmlFor="settings-field-1">Business Name</label>
            <input id="settings-field-1" value={form.business_name || ''} onChange={(e) => handleChange('business_name', e.target.value)} />
            <span className="hint">Printed at the top of every receipt.</span>
          </div>
          <div className="form-group">
            <label htmlFor="settings-field-2">Address</label>
            <input id="settings-field-2" value={form.address || ''} onChange={(e) => handleChange('address', e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="settings-field-3">Contact Number</label>
            <input id="settings-field-3" value={form.contact_number || ''} onChange={(e) => handleChange('contact_number', e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="settings-field-4">Receipt Footer</label>
            <input id="settings-field-4" value={form.receipt_footer || ''} onChange={(e) => handleChange('receipt_footer', e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="settings-field-5">Currency Symbol</label>
            <input id="settings-field-5" value={form.currency_symbol || ''} onChange={(e) => handleChange('currency_symbol', e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="settings-field-6">Printer Width</label>
            <select id="settings-field-6" value={form.printer_width || '58mm'} onChange={(e) => handleChange('printer_width', e.target.value)}>
              <option value="58mm">58mm (small thermal)</option>
              <option value="80mm">80mm (standard thermal)</option>
            </select>
          </div>
          </div>
          <div className="settings-save"><span>Changes apply to future receipts.</span><button className="btn btn-primary" type="submit"><Save size={16} /> Save Settings</button></div>
        </form>
      </div>
      <aside className="settings-preview card">
        <p className="eyebrow">A personal touch</p><h3>Your receipt identity</h3>
        <div className="receipt-identity"><BrandMark size={48} monochrome /><strong>{form.business_name || 'Your business name'}</strong><span>{form.address || 'Your business address'}</span><span>{form.contact_number || 'Your contact number'}</span><hr /><p>{form.receipt_footer || 'Your thank-you message'}</p></div>
        <p className="page-description">Preview of your shop details. Save your changes to use them on new receipts.</p>
      </aside>
      </div>

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}
