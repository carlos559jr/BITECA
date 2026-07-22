// ==========================================
// CONFIGURACIÓN DE SUPABASE
// ==========================================
const SUPABASE_URL = 'https://ptucbogjbndiiehaknet.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_CZbWLmhi_ANjcxAWqJbazg_Rk0oF8Yt'; 

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// CLASES Y LÓGICA DE LA BIBLIOTECA
// ==========================================
class BibliotecaCarlos {
    constructor(nombre) {
        this._nombre = nombre;
    }

    render(t) { 
        document.getElementById('consola').innerText = t; 
    }

    // --- GENERAR CÓDIGO AUTOMÁTICO PARA LIBROS ---
    async obtenerSiguienteCodigoLibro() {
        const { data, error } = await supabaseClient
            .from('libros')
            .select('codigo');

        if (error || !data || data.length === 0) {
            return 'L001'; // Si está vacía, empieza por L001
        }

        // Extraer los números de los códigos existentes (ej. 'L004' -> 4)
        let numeros = data.map(item => {
            let num = parseInt(item.codigo.replace(/\D/g, ''));
            return isNaN(num) ? 0 : num;
        });

        let maxNum = Math.max(...numeros);
        let siguienteNum = maxNum + 1;

        // Formatear con ceros a la izquierda (Ej: L005, L012)
        return 'L' + String(siguienteNum).padStart(3, '0');
    }

    // --- CATÁLOGO (LIBROS) ---
    async agregarLibroBD(titulo, anio, genero, autor) {
        // Generar el código de forma automática en el momento de guardar
        const codigo = await this.obtenerSiguienteCodigoLibro();

        const { data, error } = await supabaseClient
            .from('libros')
            .insert([{ codigo, titulo, anio: parseInt(anio), genero, autor, disponible: true }]);

        if (error) {
            console.error(error);
            return "Error al registrar libro: " + error.message;
        }

        // Actualizar el input visualmente para el siguiente libro
        prepararNuevoCodigo();
        return `Libro "${titulo}" guardado con éxito. Código asignado: [${codigo}]`;
    }

    async mostrarCatalogo() {
        const { data: libros, error } = await supabaseClient
            .from('libros')
            .select('*');

        if (error) {
            this.render("Error al cargar catálogo: " + error.message);
            return;
        }

        let res = `--- CATÁLOGO DE LA BIBLIOTECA ---\n`;
        if (libros.length === 0) {
            res += "No hay libros registrados.";
        } else {
            libros.forEach(m => {
                const estado = m.disponible ? '🟢 DISPONIBLE' : '🔴 PRESTADO';
                res += `[${m.codigo}] ${m.titulo} (${m.anio}) - ${m.genero} | Autor: ${m.autor} - ${estado}\n`;
            });
        }
        this.render(res);
    }

    // --- SOCIOS ---
    async agregarSocioBD(cedula, nombre) {
        const { data, error } = await supabaseClient
            .from('socios')
            .insert([{ cedula, nombre, multa_acumulada: 0.0 }]);

        if (error) {
            console.error(error);
            return "Error al registrar socio: " + error.message;
        }
        return `Socio "${nombre}" registrado exitosamente.`;
    }

    async mostrarSocios() {
        const { data: socios, error } = await supabaseClient
            .from('socios')
            .select('*');

        if (error) {
            this.render("Error al cargar socios: " + error.message);
            return;
        }

        let res = `--- SOCIOS Y DEUDAS ---\n`;
        if (socios.length === 0) {
            res += "No hay socios registrados.";
        } else {
            socios.forEach(s => {
                res += `SOCIO: ${s.nombre} | CC: ${s.cedula} | Multa: $${Number(s.multa_acumulada).toFixed(2)}\n`;
            });
        }
        this.render(res);
    }

    // --- PRÉSTAMOS ---
    async realizarPrestamo(codMaterial, cedSocio, dias) {
        const { data: libro, error: errLibro } = await supabaseClient
            .from('libros')
            .select('*')
            .eq('codigo', codMaterial)
            .single();

        if (errLibro || !libro) return "Error: Material no encontrado.";
        if (!libro.disponible) return "Error: El material ya está prestado.";

        const { data: socio, error: errSocio } = await supabaseClient
            .from('socios')
            .select('*')
            .eq('cedula', cedSocio)
            .single();

        if (errSocio || !socio) return "Error: Socio no encontrado.";

        const { error: errPrestamo } = await supabaseClient
            .from('prestamos')
            .insert([{ codigo_libro: codMaterial, cedula_socio: cedSocio, dias_plazo: dias }]);

        if (errPrestamo) return "Error al registrar préstamo: " + errPrestamo.message;

        await supabaseClient
            .from('libros')
            .update({ disponible: false })
            .eq('codigo', codMaterial);

        return `Préstamo realizado con éxito a ${socio.nombre}.`;
    }

    // --- DEVOLUCIONES ---
    async procesarDevolucion(codMaterial, cedSocio, diasRetraso) {
        const { data: socio, error: errSocio } = await supabaseClient
            .from('socios')
            .select('*')
            .eq('cedula', cedSocio)
            .single();

        if (errSocio || !socio) return "Error: Socio no encontrado.";

        const multaCalculada = diasRetraso > 0 ? diasRetraso * 0.80 : 0;
        const nuevaMulta = Number(socio.multa_acumulada) + multaCalculada;

        await supabaseClient
            .from('socios')
            .update({ multa_acumulada: nuevaMulta })
            .eq('cedula', cedSocio);

        await supabaseClient
            .from('libros')
            .update({ disponible: true })
            .eq('codigo', codMaterial);

        return `Devolución exitosa. Multa generada: $${multaCalculada.toFixed(2)}. Total deuda: $${nuevaMulta.toFixed(2)}`;
    }

    // --- ELIMINAR REGISTROS ---
    async eliminarLibro(codigo) {
        const { error } = await supabaseClient.from('libros').delete().eq('codigo', codigo);
        if (error) return "Error al eliminar libro: " + error.message;
        prepararNuevoCodigo();
        return `Libro con código ${codigo} eliminado.`;
    }

    async eliminarSocio(cedula) {
        const { error } = await supabaseClient.from('socios').delete().eq('cedula', cedula);
        if (error) return "Error al eliminar socio: " + error.message;
        return `Socio con cédula ${cedula} eliminado.`;
    }
}

const biblioteca = new BibliotecaCarlos("Biblioteca Unisalamanca");

// ==========================================
// FUNCIONES DE LA INTERFAZ (UI) Y AUTOMATIZACIÓN
// ==========================================

// Función auxiliar para rellenar automáticamente el input de código de libro
async function prepararNuevoCodigo() {
    const inputCod = document.getElementById('l-cod');
    if (inputCod) {
        inputCod.value = "Calculando...";
        const siguiente = await biblioteca.obtenerSiguienteCodigoLibro();
        inputCod.value = siguiente;
    }
}

// Cargar catálogo automáticamente al abrir la página y preparar el código
window.onload = async () => {
    biblioteca.render("Conectado a Supabase. Cargando datos...");
    await prepararNuevoCodigo();
    await biblioteca.mostrarCatalogo();
};

async function uiAgregarLibro() {
    const tit = document.getElementById('l-tit').value;
    const anio = document.getElementById('l-anio').value;
    const gen = document.getElementById('l-gen').value;
    const aut = document.getElementById('l-aut').value;

    if (!tit || !aut) {
        alert("Por favor completa al menos el título y el autor.");
        return;
    }

    const msj = await biblioteca.agregarLibroBD(tit, anio, gen, aut);
    biblioteca.render(msj);
    await biblioteca.mostrarCatalogo(); // Refrescar catálogo automáticamente
}

async function uiAgregarSocio() {
    const ced = document.getElementById('s-ced').value;
    const nom = document.getElementById('s-nom').value;

    if (!ced || !nom) {
        alert("Por favor llena todos los campos del socio.");
        return;
    }

    const msj = await biblioteca.agregarSocioBD(ced, nom);
    biblioteca.render(msj);
}

async function uiPrestar() {
    const cod = prompt("Ingrese Código del Material (Ej: L001):");
    const ced = prompt("Ingrese Cédula del Socio:");
    const dias = parseInt(prompt("Días de plazo:"), 10);
    
    if (!cod || !ced) return;
    const msj = await biblioteca.realizarPrestamo(cod, ced, dias);
    biblioteca.render(msj);
    await biblioteca.mostrarCatalogo();
}

async function uiDevolver() {
    const cod = prompt("Código del Material que devuelve:");
    const ced = prompt("Cédula del Socio:");
    const retraso = parseInt(prompt("Días de retraso (0 si entregó a tiempo):"), 10);
    
    if (!cod || !ced) return;
    const msj = await biblioteca.procesarDevolucion(cod, ced, retraso);
    biblioteca.render(msj);
    await biblioteca.mostrarCatalogo();
}

async function uiEliminarLibro() {
    const id = document.getElementById('del-id').value;
    if (!id) { alert("Ingresa un código de libro"); return; }
    const msj = await biblioteca.eliminarLibro(id);
    biblioteca.render(msj);
    await biblioteca.mostrarCatalogo();
}

async function uiEliminarSocio() {
    const id = document.getElementById('del-id').value;
    if (!id) { alert("Ingresa una cédula de socio"); return; }
    const msj = await biblioteca.eliminarSocio(id);
    biblioteca.render(msj);
}