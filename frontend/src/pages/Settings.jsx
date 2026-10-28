import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '../services/api';
import Toast from '../components/Toast';

export default function Settings() {
  const [form, setForm] = useState({});
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/settings').then(setForm).finally(() => setLoading(false));
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
      <div className="page-header"><h2>Business Settings</h2></div>

      <div className="card" style={{ maxWidth: 560 }}>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Business Name</label>
            <input value={form.business_name || ''} onChange={(e) => handleChange('business_name', e.target.value)} />
            <span className="hint">Printed at the top of every receipt.</span>
          </div>
          <div className="form-group">
            <label>Address</label>
            <input value={form.address || ''} onChange={(e) => handleChange('address', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Contact Number</label>
            <input value={form.contact_number || ''} onChange={(e) => handleChange('contact_number', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Receipt Footer</label>
            <input value={form.receipt_footer || ''} onChange={(e) => handleChange('receipt_footer', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Currency Symbol</label>
            <input value={form.currency_symbol || ''} onChange={(e) => handleChange('currency_symbol', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Printer Width</label>
            <select value={form.printer_width || '58mm'} onChange={(e) => handleChange('printer_width', e.target.value)}>
              <option value="58mm">58mm (small thermal)</option>
              <option value="80mm">80mm (standard thermal)</option>
            </select>
          </div>
          <button className="btn btn-primary" type="submit"><Save size={16} /> Save Settings</button>
        </form>
      </div>

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}
