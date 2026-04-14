import re

with open("frontend/src/App.tsx", "r") as f:
    content = f.read()

# Replace handleOtaUpload
old_handle = """  const handleOtaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authToken) return;
    if (!file.name.endsWith(".bin") && !file.name.endsWith(".tflite")) return toast.error("[SecOps] Solo .bin o .tflite.");

    const formData = new FormData(); formData.append("firmware", file);
    try {
      setWsStatus("Flasheando Firmware (No desconectar)...");
      const apiUrl = import.meta.env.DEV ? "http://192.168.1.171/api/system/ota" : "/api/system/ota";
      const response = await apiFetch(apiUrl, { method: "POST", headers: { Authorization: `Bearer ${authToken}` }, body: formData });
      if (!response.ok) throw new Error("Error fatal durante el flasheo.");
      
      toast.success("Actualización Exitosa. El panel perderá conexión momentáneamente.");
      handleLogout();
    } catch (error: any) {
      toast.error(`[SecOps] Abortado: ${error.message}`);
      setWsStatus("Conectado");
    }
  };"""

new_handle = """  const [otaUrl, setOtaUrl] = useState("");

  const handleOtaUpload = async () => {
    if (!otaUrl || !authToken) return toast.error("Ingrese una URL válida.");
    if (!otaUrl.startsWith("https://")) return toast.error("La URL debe ser HTTPS segura.");

    try {
      setWsStatus("Descargando y Flasheando Firmware...");
      const apiUrl = import.meta.env.DEV ? "http://192.168.1.171/api/system/ota" : "/api/system/ota";
      const response = await apiFetch(apiUrl, { 
        method: "POST", 
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }, 
        body: JSON.stringify({ url: otaUrl }) 
      });
      if (!response.ok) throw new Error("Error fatal durante el flasheo.");
      
      toast.success("Actualización iniciada. El dispositivo se reiniciará automáticamente al terminar.");
      setOtaUrl("");
    } catch (error: any) {
      toast.error(`[SecOps] Abortado: ${error.message}`);
      setWsStatus("Conectado");
    }
  };"""

# Replace the input element in JSX
old_jsx = """                  <input
                    type="file"
                    accept=".bin,.tflite"
                    className="hidden"
                    id="ota-upload"
                    onChange={handleOtaUpload}
                  />
                  <label
                    htmlFor="ota-upload"
                    className="mt-4 inline-block px-4 py-2 bg-navy-dark text-white rounded font-bold cursor-pointer hover:bg-gray-800 shadow"
                  >
                    Seleccionar Archivo
                  </label>"""

new_jsx = """                  <div className="mt-4 flex gap-2">
                    <input
                      type="url"
                      placeholder="https://..."
                      value={otaUrl}
                      onChange={(e) => setOtaUrl(e.target.value)}
                      className="flex-1 p-2 border border-gray-300 rounded font-mono text-sm outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      onClick={handleOtaUpload}
                      className="px-4 py-2 bg-navy-dark text-white rounded font-bold hover:bg-gray-800 shadow whitespace-nowrap"
                    >
                      Flashear
                    </button>
                  </div>"""

if old_handle in content and old_jsx in content:
    content = content.replace(old_handle, new_handle)
    content = content.replace(old_jsx, new_jsx)
    with open("frontend/src/App.tsx", "w") as f:
        f.write(content)
    print("Patch applied to App.tsx successfully.")
else:
    print("Could not find the text to replace in App.tsx.")
