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
            return 'L001';
        }

        let numeros = data.map(item => {
            let num = parseInt(item.codigo.replace(/\D/g, ''));
            return isNaN(num) ? 0 : num;
        });

        let maxNum = Math.max(...numeros);
        let siguienteNum = maxNum + 1;

        return 'L' + String(siguienteNum).padStart(3, '0');
    }

    // --- CATÁLOGO (LIBROS) CON DETALLE DE QUIÉN LO TIENE ---
    async agregarLibroBD(titulo, anio, genero, autor) {
        const codigo = await this.obtenerSiguienteCodigoLibro();

        const { data, error } = await supabaseClient
            .from('libros')
            .insert([{ codigo, titulo, anio: parseInt(anio), genero, autor, disponible: true }]);

        if (error) {
            console.error(error);
            return "Error al registrar libro: " + error.message;
        }

        prepararNuevoCodigo();
        return `Libro "${titulo}" guardado con éxito. Código asignado: [${codigo}]`;
    }

    async mostrarCatalogo() {
        // Consultamos los libros y también traemos información del préstamo activo y el socio correspondiente
        const { data: libros, error } = await supabaseClient
            .from('libros')
            .select(`
                *,
                prestamos (
                    dias_plazo,
                    fecha_prestamo,
                    socios ( cedula, nombre )
                )
            `);

        if (error) {
            this.render("Error al cargar catálogo: " + error.message);
            return;
        }

        let res = `--- CATÁLOGO DE LA BIBLIOTECA ---\n`;
        if (libros.length === 0) {
            res += "No hay libros registrados.";
        } else {
            libros.forEach(m => {
                let estadoTexto = '🟢 DISPONIBLE';
                
                if (!m.disponible) {
                    // Buscar si hay un préstamo activo vinculado
                    let prestamoActivo = m.prestamos && m.prestamos.length > 0 ? m.prestamos[0] : null;
                    let nombreSocio = prestamoActivo && prestamoActivo.socios ? prestamoActivo.socios.nombre : "Desconocido";
                    let cedulaSocio = prestamoActivo && prestamoActivo.socios ? prestamoActivo.socios.cedula : "";
                    
                    estadoTexto = `🔴 PRESTADO a: ${nombreSocio} (CC: ${cedulaSocio})`;
                }

                res += `[${m.codigo}] ${m.titulo} (${m.anio}) - ${m.genero} | Autor: ${m.autor}\n   Estado: ${estadoTexto}\n\n`;
            });
        }
        this.render(res);
    }

    // --- SOCIOS CON DETALLE DE QUÉ LIBRO TIENEN ---
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
        // Consultamos los socios y traemos sus préstamos activos junto con los datos del libro
        const { data: socios, error } = await supabaseClient
            .from('socios')
            .select(`
                *,
                prestamos (
                    dias_plazo,
                    fecha_prestamo,
                    libros ( codigo, titulo )
                )
            `);

        if (error) {
            this.render("Error al cargar socios: " + error.message);
            return;
        }

        let res = `--- SOCIOS Y LIBROS EN SU PODER ---\n`;
        if (socios.length === 0) {
            res += "No hay socios registrados.";
        } else {
            socios.forEach(s => {
                res += `SOCIO: ${s.nombre} | CC: ${s.cedula} | Multa Adeudada: $${Number(s.multa_acumulada).toFixed(2)}\n`;
                
                if (s.prestamos && s.prestamos.length > 0) {
                    res += `  📚 Libros en préstamo:\n`;
                    s.prestamos.forEach(p => {
                        let tituloLibro = p.libros ? p.libros.titulo : "Desconocido";
                        let codLibro = p.libros ? p.libros.codigo : "";
                        res += `    - [${codLibro}] ${tituloLibro} (Plazo: ${p.dias_plazo} días)\n`;
                    });
                } else {
                    res += `  📚 Sin libros prestados actualmente.\n`;
                }
                res += `--------------------------------------------------\n`;
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

        // Actualizar multa del socio
        await supabaseClient
            .from('socios')
            .update({ multa_acumulada: nuevaMulta })
            .eq('cedula', cedSocio);

        // Marcar libro como disponible de nuevo
        await supabaseClient
            .from('libros')
            .update({ disponible: true })
            .eq('codigo', codMaterial);

        // Eliminar el registro de préstamo activo de la tabla prestamos
        await supabaseClient
            .from('prestamos')
            .delete()
            .match({ codigo_libro: codMaterial, cedula_socio: cedSocio });

        return `Devolución exitosa. Multa generada: $${multaCalculada.toFixed(2)}. Total deuda: $${nuevaMulta.toFixed(2)}`;
    }

    // --- PAGAR MULTA ---
    async pagarMulta(cedSocio, montoPago) {
        const { data: socio, error: errSocio } = await supabaseClient
            .from('socios')
            .select('*')
            .eq('cedula', cedSocio)
            .single();

        if (errSocio || !socio) return "Error: Socio no encontrado.";

        let multaActual = Number(socio.multa_acumulada);
        if (multaActual <= 0) return `El socio ${socio.nombre} no tiene deudas pendientes.`;

        if (montoPago > multaActual) {
            return `Error: El monto a pagar ($${montoPago.toFixed(2)}) supera la deuda actual ($${multaActual.toFixed(2)}).`;
        }

        let nuevaMulta = multaActual - montoPago;

        const { error: errUpdate } = await supabaseClient
            .from('socios')
            .update({ multa_acumulada: nuevaMulta })
            .eq('cedula', cedSocio);

        if (errUpdate) return "Error al procesar el pago: " + errUpdate.message;

        return `Pago exitoso de $${montoPago.toFixed(2)}. Deuda restante de ${socio.nombre}: $${nuevaMulta.toFixed(2)}`;
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

async function prepararNuevoCodigo() {
    const inputCod = document.getElementById('l-cod');
    if (inputCod) {
        inputCod.value = "Calculando...";
        const siguiente = await biblioteca.obtenerSiguienteCodigoLibro();
        inputCod.value = siguiente;
    }
}

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
    await biblioteca.mostrarCatalogo();
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

async function uiPagarMulta() {
    const ced = prompt("Ingrese Cédula del Socio que va a pagar:");
    const monto = parseFloat(prompt("Ingrese el monto a pagar ($):"));

    if (!ced || isNaN(monto) || monto <= 0) {
        alert("Por favor ingrese datos válidos.");
        return;
    }

    const msj = await biblioteca.pagarMulta(ced, monto);
    biblioteca.render(msj);
    await biblioteca.mostrarSocios(); // Refrescar vista de socios automáticamente
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