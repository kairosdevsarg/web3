
const chatbotData = {
  inicio: {
    mensaje: "¿En qué puedo ayudarte hoy?",
    opciones: [
      { texto: "📅 Consultar sobre turnos", destino: "turnos" },
      { texto: "🐶 Registrar una mascota", destino: "pacientes" },
      { texto: "💉 Vacunas", destino: "vacunas" },
      { texto: "📦 Inventario", destino: "inventario" },
      { texto: "👩‍⚕️ Contactar al veterinario", destino: "veterinario" }
    ]
  },

  turnos: {
    mensaje:
      "Desde el módulo Turnos podés consultar la agenda y registrar una cita indicando la fecha, la hora y la mascota correspondiente.",
    opciones: [
      { texto: "¿Cómo registro un turno?", destino: "crearTurno" },
      { texto: "¿Dónde veo la agenda?", destino: "agenda" },
      { texto: "¿Cómo cancelo un turno?", destino: "cancelar" }
    ]
  },

  crearTurno: {
    mensaje:
      "Ingresá al módulo Turnos, seleccioná la opción para crear un turno y completá los datos solicitados. Verificá la fecha y la hora antes de guardar.",
    opciones: [
      { texto: "Consultar sobre turnos", destino: "turnos" }
    ]
  },

  agenda: {
    mensaje:
      "Abrí el módulo Turnos para consultar la agenda y revisar las citas registradas en el calendario.",
    opciones: [
      { texto: "Consultar sobre turnos", destino: "turnos" }
    ]
  },

  cancelar: {
    mensaje:
      "Buscá el turno en la agenda y revisá las acciones disponibles. Si tu perfil no permite cancelarlo, solicitá ayuda al administrador de la clínica.",
    opciones: [
      { texto: "Consultar sobre turnos", destino: "turnos" }
    ]
  },

  pacientes: {
    mensaje:
      "Ingresá a Pacientes. Podés buscar una mascota existente o seleccionar «Ingresar nuevo paciente» para registrar sus datos.",
    opciones: [
      { texto: "¿Qué datos necesito?", destino: "datosMascota" },
      { texto: "¿Cómo busco una mascota?", destino: "buscarMascota" }
    ]
  },

  datosMascota: {
    mensaje:
      "Prepará los datos que solicite el formulario: nombre de la mascota, especie, edad o fecha de nacimiento, raza, peso y datos del responsable. Los campos disponibles dependen de tu formulario.",
    opciones: [
      { texto: "Volver a Pacientes", destino: "pacientes" }
    ]
  },

  buscarMascota: {
    mensaje:
      "Entrá al módulo Pacientes y utilizá el buscador para encontrar la ficha de la mascota según los criterios que admita tu sistema.",
    opciones: [
      { texto: "Volver a Pacientes", destino: "pacientes" }
    ]
  },

  vacunas: {
    mensaje:
      "Consultá la libreta de vacunación o los registros disponibles en la ficha del paciente. Para confirmar qué vacuna corresponde y cuándo aplicarla, consultá al veterinario.",
    opciones: [
      { texto: "Volver a Pacientes", destino: "pacientes" }
    ]
  },

  inventario: {
    mensaje:
      "En el módulo Inventario podés consultar los insumos, medicamentos y productos registrados. Las acciones para modificar existencias dependen de tu rol.",
    opciones: [
      { texto: "Volver al menú principal", destino: "inicio" }
    ]
  },

  veterinario: {
    mensaje:
      "Para consultas clínicas, diagnósticos o indicaciones de tratamiento, contactá directamente al veterinario de la clínica. Este asistente solo brinda información general sobre el sistema.",
    opciones: [
      { texto: "Volver al menú principal", destino: "inicio" }
    ]
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("chatbot-toggle");
  const panel = document.getElementById("chatbot-panel");
  const close = document.getElementById("chatbot-close");
  const messages = document.getElementById("chatbot-messages");
  const options = document.getElementById("chatbot-options");
  const home = document.getElementById("chatbot-home");

  if (!toggle || !panel || !close || !messages || !options || !home) {
    console.error("No se encontraron todos los elementos del chatbot.");
    return;
  }

  function openChat() {
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Cerrar asistente de Patitas");
    renderOptions("inicio");
  }

  function closeChat() {
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir asistente de Patitas");
    toggle.focus();
  }

  function addMessage(text, type) {
    const message = document.createElement("div");
    message.className = `chatbot-message ${type}`;
    message.textContent = text;
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
  }

  function renderOptions(section) {
    const data = chatbotData[section];

    if (!data) {
      addMessage("No encontré esa opción. Volvé al menú principal.", "bot");
      return;
    }

    addMessage(data.mensaje, "bot");
    options.replaceChildren();

    data.opciones.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chatbot-option";
      button.textContent = option.texto;

      button.addEventListener("click", () => {
        addMessage(option.texto, "user");
        renderOptions(option.destino);
      });

      options.appendChild(button);
    });
  }

  toggle.addEventListener("click", () => {
    if (panel.hidden) {
      openChat();
    } else {
      closeChat();
    }
  });

  close.addEventListener("click", closeChat);

  home.addEventListener("click", () => {
    addMessage("Volver al menú principal", "user");
    renderOptions("inicio");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      closeChat();
    }
  });
});
