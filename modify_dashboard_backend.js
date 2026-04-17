const fs = require('fs');
let content = fs.readFileSync('frontend/src/views/Dashboard.tsx', 'utf8');

// 1. In useEffect([]), add fetch for /api/config/dashboard
const useEffectFind = `  useEffect(() => {
    // Cargar fechas disponibles`;

const useEffectReplace = `  useEffect(() => {
    // Cargar preferencias del backend
    apiFetch('/api/config/dashboard')
      .then(res => res.json())
      .then(data => {
        if (data.zones && Array.isArray(data.zones)) {
          setZonePrefs(data.zones);
          localStorage.setItem('dashboard_zone_prefs', JSON.stringify(data.zones));
        }
      })
      .catch(() => {});

    // Cargar fechas disponibles`;

content = content.replace(useEffectFind, useEffectReplace);

// 2. Add Save function for backend
const saveFuncFind = `  const [showSettings, setShowSettings] = useState(false);

  const updateZonePref = (index: number, key: keyof ZonePref, value: any) => {`;

const saveFuncReplace = `  const [showSettings, setShowSettings] = useState(false);

  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  const handleSavePrefs = async () => {
    setIsSavingPrefs(true);
    try {
      const res = await apiFetch('/api/config/dashboard', {
        method: 'POST',
        body: JSON.stringify({ zones: zonePrefs })
      });
      if (res.ok) {
        toast.success('Preferencias guardadas en el backend.');
      } else {
        toast.error('Error al guardar preferencias.');
      }
    } catch (e) {
      toast.error('Error de red al guardar.');
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const updateZonePref = (index: number, key: keyof ZonePref, value: any) => {`;

content = content.replace(saveFuncFind, saveFuncReplace);

// 3. Add Save button to UI
const uiFind = `        <div className='bg-panel p-4 rounded-lg border border-border-color shadow-sm mb-4 animate-fade-in'>
          <h4 className='text-sm font-bold text-primary mb-3'>Personalización de Gráficos (Zonas)</h4>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4'>`;

const uiReplace = `        <div className='bg-panel p-4 rounded-lg border border-border-color shadow-sm mb-4 animate-fade-in'>
          <div className='flex justify-between items-center mb-3'>
            <h4 className='text-sm font-bold text-primary'>Personalización de Gráficos (Zonas)</h4>
            <button onClick={handleSavePrefs} disabled={isSavingPrefs} className='btn btn-primary text-xs py-1 px-3'>
              {isSavingPrefs ? 'Guardando...' : 'Guardar en Servidor'}
            </button>
          </div>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4'>`;

content = content.replace(uiFind, uiReplace);

fs.writeFileSync('frontend/src/views/Dashboard.tsx', content);
console.log('Dashboard.tsx updated for backend save');
