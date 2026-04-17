const fs = require('fs');

let content = fs.readFileSync('frontend/src/views/Dashboard.tsx', 'utf8');

// 1. Add Brush to imports
content = content.replace('  ZAxis,\n} from \'recharts\';', '  ZAxis,\n  Brush,\n} from \'recharts\';');

// 2. Add Prefs types and default after COLORS
const prefsCode = `
export interface ZonePref {
  name: string;
  color: string;
  lineType: 'monotone' | 'linear' | 'step';
  strokeDasharray: string;
  dot: boolean;
}

const DEFAULT_PREFS: ZonePref[] = [
  { name: 'Zona 1', color: '#F87171', lineType: 'monotone', strokeDasharray: '', dot: false },
  { name: 'Zona 2', color: '#FBBF24', lineType: 'monotone', strokeDasharray: '', dot: false },
  { name: 'Zona 3', color: '#34D399', lineType: 'monotone', strokeDasharray: '', dot: false },
  { name: 'Zona 4', color: '#60A5FA', lineType: 'monotone', strokeDasharray: '', dot: false },
  { name: 'Zona 5', color: '#A78BFA', lineType: 'monotone', strokeDasharray: '', dot: false },
];
`;
content = content.replace('const Dashboard = () => {', prefsCode + '\nconst Dashboard = () => {');

// 3. Add states
const statesCode = `
  const [zonePrefs, setZonePrefs] = useState<ZonePref[]>(() => {
    const saved = localStorage.getItem('dashboard_zone_prefs');
    return saved ? JSON.parse(saved) : DEFAULT_PREFS;
  });
  const [showSettings, setShowSettings] = useState(false);

  const updateZonePref = (index: number, key: keyof ZonePref, value: any) => {
    const newPrefs = [...zonePrefs];
    newPrefs[index] = { ...newPrefs[index], [key]: value };
    setZonePrefs(newPrefs);
    localStorage.setItem('dashboard_zone_prefs', JSON.stringify(newPrefs));
  };
`;
content = content.replace('  const [timeWindow, setTimeWindow] = useState<number>(60);', '  const [timeWindow, setTimeWindow] = useState<number>(60);' + statesCode);

// 4. Update Zona text in Grid
content = content.replace(/Zona \{id \+ 1\}/g, '{zonePrefs[id].name}');

// 5. Update Toolbar to add button
const toolbarFind = `<div className='flex items-center gap-2 text-sm font-semibold'>
          <span className='text-secondary'>Ventana de Análisis:</span>`;
const toolbarReplace = `<div className='flex items-center gap-4'>
          <button onClick={() => setShowSettings(!showSettings)} className='btn btn-secondary text-sm py-1 px-3 flex items-center gap-2'>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            Gráficos
          </button>
          <div className='flex items-center gap-2 text-sm font-semibold'>
            <span className='text-secondary'>Ventana:</span>`;
content = content.replace(toolbarFind, toolbarReplace);

// 5.b Match ending of Toolbar to inject Settings UI
const gridFind = `      {/* GRID MULTI-ZONAS */}`;
const settingsUI = `
      {showSettings && (
        <div className='bg-panel p-4 rounded-lg border border-border-color shadow-sm mb-4 animate-fade-in'>
          <h4 className='text-sm font-bold text-primary mb-3'>Personalización de Gráficos (Zonas)</h4>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4'>
            {[0, 1, 2, 3, 4].map(id => (
              <div key={\`pref-\${id}\`} className='space-y-2 border border-border-color p-3 rounded bg-app'>
                <input type='text' value={zonePrefs[id].name} onChange={e => updateZonePref(id, 'name', e.target.value)} className='input-field text-sm font-bold w-full' placeholder={\`Zona \${id+1}\`} />
                <div className='flex items-center gap-2'>
                  <input type='color' value={zonePrefs[id].color} onChange={e => updateZonePref(id, 'color', e.target.value)} className='w-8 h-8 rounded cursor-pointer shrink-0 border-0 p-0' />
                  <select value={zonePrefs[id].lineType} onChange={e => updateZonePref(id, 'lineType', e.target.value as any)} className='input-field text-xs flex-1'>
                    <option value='monotone'>Curva</option>
                    <option value='linear'>Recta</option>
                    <option value='step'>Escalón</option>
                  </select>
                </div>
                <div className='flex items-center justify-between text-xs text-text-secondary'>
                  <label className='flex items-center gap-1 cursor-pointer'><input type='checkbox' checked={zonePrefs[id].strokeDasharray === '5 5'} onChange={e => updateZonePref(id, 'strokeDasharray', e.target.checked ? '5 5' : '')} /> Punteada</label>
                  <label className='flex items-center gap-1 cursor-pointer'><input type='checkbox' checked={zonePrefs[id].dot} onChange={e => updateZonePref(id, 'dot', e.target.checked)} /> Puntos</label>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

`;
content = content.replace(gridFind, settingsUI + gridFind);


// 6. Update Lines in Main Chart
const linesMainFind = `                {[0, 1, 2, 3, 4].map(id => (
                    <Line key={\`T\${id}\`} hide={hiddenLines[\`T\${id}\`]} yAxisId='left' name={\`Temp Z\${id+1}\`} type='monotone' dataKey={\`T\${id}\`} stroke={COLORS[id]} strokeWidth={2} dot={false} isAnimationActive={false} />
                ))}
                {[0, 1, 2, 3, 4].map(id => (
                    <Line key={\`H\${id}\`} hide={hiddenLines[\`H\${id}\`]} yAxisId='right' name={\`Hum Z\${id+1}\`} type='monotone' strokeDasharray="5 5" dataKey={\`H\${id}\`} stroke={COLORS[id]} strokeWidth={2} dot={false} isAnimationActive={false} />
                ))}
              </LineChart>`;
const linesMainReplace = `                {[0, 1, 2, 3, 4].map(id => (
                    <Line key={\`T\${id}\`} hide={hiddenLines[\`T\${id}\`]} yAxisId='left' name={\`\${zonePrefs[id].name} (T)\`} type={zonePrefs[id].lineType} dataKey={\`T\${id}\`} stroke={zonePrefs[id].color} strokeDasharray={zonePrefs[id].strokeDasharray} strokeWidth={2} dot={zonePrefs[id].dot} isAnimationActive={false} />
                ))}
                {[0, 1, 2, 3, 4].map(id => (
                    <Line key={\`H\${id}\`} hide={hiddenLines[\`H\${id}\`]} yAxisId='right' name={\`\${zonePrefs[id].name} (H)\`} type={zonePrefs[id].lineType} strokeDasharray={zonePrefs[id].strokeDasharray || "5 5"} dataKey={\`H\${id}\`} stroke={zonePrefs[id].color} strokeWidth={2} dot={zonePrefs[id].dot} opacity={0.6} isAnimationActive={false} />
                ))}
                <Brush dataKey="time" height={30} stroke="#3B8FF3" fill="#1E1E2C" travellerWidth={10} />
              </LineChart>`;
content = content.replace(linesMainFind, linesMainReplace);

// 7. Update Brush in VBAT Chart
const vbatFind = `                <Line type='monotone' dataKey='Voltaje' name='Voltaje Batería' stroke='#8B5CF6' strokeWidth={2} dot={false} activeDot={{ r: 5, fill: '#8B5CF6' }} isAnimationActive={false} />
              </LineChart>`;
const vbatReplace = `                <Line type='monotone' dataKey='Voltaje' name='Voltaje Batería' stroke='#8B5CF6' strokeWidth={2} dot={false} activeDot={{ r: 5, fill: '#8B5CF6' }} isAnimationActive={false} />
                <Brush dataKey="time" height={30} stroke="#8B5CF6" fill="#1E1E2C" travellerWidth={10} />
              </LineChart>`;
content = content.replace(vbatFind, vbatReplace);

// 8. Update Lines in Historical Chart
const linesHistFind = `                        {[0, 1, 2, 3, 4].map(id => (
                            <Line key={\`T\${id}\`} hide={hiddenLines[\`T\${id}\`]} yAxisId='left' name={\`Temp Z\${id+1}\`} type='monotone' dataKey={\`T\${id}\`} stroke={COLORS[id]} strokeWidth={2} dot={false} isAnimationActive={false} />
                        ))}
                        {[0, 1, 2, 3, 4].map(id => (
                            <Line key={\`H\${id}\`} hide={hiddenLines[\`H\${id}\`]} yAxisId='right' name={\`Hum Z\${id+1}\`} type='monotone' strokeDasharray="5 5" dataKey={\`H\${id}\`} stroke={COLORS[id]} strokeWidth={2} dot={false} isAnimationActive={false} />
                        ))}
                      </LineChart>`;
const linesHistReplace = `                        {[0, 1, 2, 3, 4].map(id => (
                            <Line key={\`T\${id}\`} hide={hiddenLines[\`T\${id}\`]} yAxisId='left' name={\`\${zonePrefs[id].name} (T)\`} type={zonePrefs[id].lineType} dataKey={\`T\${id}\`} stroke={zonePrefs[id].color} strokeDasharray={zonePrefs[id].strokeDasharray} strokeWidth={2} dot={zonePrefs[id].dot} isAnimationActive={false} />
                        ))}
                        {[0, 1, 2, 3, 4].map(id => (
                            <Line key={\`H\${id}\`} hide={hiddenLines[\`H\${id}\`]} yAxisId='right' name={\`\${zonePrefs[id].name} (H)\`} type={zonePrefs[id].lineType} strokeDasharray={zonePrefs[id].strokeDasharray || "5 5"} dataKey={\`H\${id}\`} stroke={zonePrefs[id].color} strokeWidth={2} dot={zonePrefs[id].dot} opacity={0.6} isAnimationActive={false} />
                        ))}
                        <Brush dataKey="time" height={30} stroke="#F29F67" fill="#1E1E2C" travellerWidth={10} />
                      </LineChart>`;
content = content.replace(linesHistFind, linesHistReplace);


fs.writeFileSync('frontend/src/views/Dashboard.tsx', content);
console.log('Successfully updated Dashboard.tsx');
