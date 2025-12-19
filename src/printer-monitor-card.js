/* Orginal author: Grzegorz Russek
    MIT License */
console.info("%c PRINTER-MONITOR-CARD loading", "color: white; background: #4caf50; padding: 4px;");

class PrinterMonitorCardEditor extends HTMLElement {
    static get localizations() {
        return {
            en: {
                editor_title: "Printer Configuration (Prefix + Explicit Entities)",

                printer_name: "1. Printer Name",
                printer: "2. Entity Prefix (e.g., 'tevo_tarantula')",
                printer_switch: "3. Printer Switch",
                toggle_script: "4. Toggle Script",
                live_camera: "5. Live Camera (Optional)",
                live_camera_rotation: "6. Camera Rotation (Optional)",

                entity_placeholder: "entity_id.domain (Optional)",
                entity_tooltip: "Enter Entity ID, e.g. {domain}.my_device",

                toggle_confirm: "Are you sure you want to toggle the power for {printer_name}?"
            },
            pl: {
                editor_title: "Konfiguracja Drukarki (Prefix + Jawne Encje)",

                printer_name: "1. Nazwa drukarki",
                printer: "2. Prefiks encji (np. 'tevo_tarantula')",
                printer_switch: "3. Włącznik drukarki",
                toggle_script: "4. Skrypt włącz/wyłącz",
                live_camera: "5. Kamera na żywo (Opcj.)",
                live_camera_rotation: "6. Obrót kamery (Opcj.)",

                entity_placeholder: "entity_id.domena (Opcjonalnie)",
                entity_tooltip: "Wprowadź Entity ID, np. {domain}.moj_sprzet",

                toggle_confirm: "Czy na pewno chcesz włączyć/wyłączyć drukarkę {printer_name}?"
            }
        };
    }

    _localize(key, lang = this.hass?.language || 'en', vars = {}) {
        const translations = PrinterMonitorCardEditor.localizations;
        let translation = translations[lang]?.[key] || translations['en'][key] || key;
        
        for (const [varKey, varValue] of Object.entries(vars)) {
            translation = translation.replace(`{${varKey}}`, varValue);
        }
        return translation;
    }

    set hass(hass) {
        this._hass = hass;
        this.querySelectorAll('ha-entity-picker').forEach(picker => {
            if (picker.hass !== hass) {
                picker.hass = hass;
            }
        });
    }

    setConfig(config) {
        this._config = config;
        this._initializeEditor();
    }

    _getFields() {
        const lang = this.hass?.language;
        return [
            { key: "printer_name", label: this._localize("printer_name", lang), type: "text" },
            { key: "printer", label: this._localize("printer", lang), type: "text" },
            { key: "printer_switch", label: this._localize("printer_switch", lang), type: "entity", domain: "switch" },
            { key: "toggle_script", label: this._localize("toggle_script", lang), type: "script", domain: "script" }, 
            { key: "live_camera", label: this._localize("live_camera", lang), type: "entity", domain: "camera" },
            { key: "live_camera_rotation", label: this._localize("live_camera_rotation", lang), type: "number", min: 0, max: 360, step: 1, default: 0 },
        ];
    }

    _initializeEditor() {
        if (!this.shadowRoot) {
            this.attachShadow({ mode: 'open' });
            
            const style = document.createElement("style");
            style.textContent = `
                .field-wrapper { margin-bottom: 16px; border-top: 1px solid var(--divider-color); padding-top: 8px; }
                label { font-weight: bold; display: block; margin-bottom: 4px; color: var(--primary-text-color); }
                input, ha-entity-picker { width: 100%; box-sizing: border-box; }
                ha-entity-picker { padding: 4px 0; }
                h4 { margin-top: 0; }
            `;
            this.shadowRoot.appendChild(style);
            
            const lang = this.hass?.language;
            const container = document.createElement("div");

            container.innerHTML = `<h4>${this._localize("editor_title", lang)}</h4>`;
            this.shadowRoot.appendChild(container);

            this._getFields().forEach(f => {
                const wrapper = document.createElement("div");
                wrapper.className = "field-wrapper";

                const label = document.createElement("label");
                label.textContent = f.label;
                wrapper.appendChild(label);

                let input;
                const value = this._config[f.key] || "";

                if (f.type === "text" || f.type === "number") {
                    input = document.createElement("input");
                    input.type = f.type;
                    input.value = value;
                    if (f.type === "number") {
                        input.min = f.min;
                        input.max = f.max;
                        input.step = f.step;
                    }
                } else if (f.type === "entity" || f.type === "script") {
                    input = document.createElement("input");
                    input.type = "text";
                    input.value = value;

                    input.className = "ha-form-entity-select"; 

                    input.placeholder = this._localize("entity_placeholder", lang);

                    input.title = this._localize("entity_tooltip", lang, { domain: f.domain });
                }

                const eventName = f.type === "entity" ? "change" : "input";
                input.addEventListener(eventName, (ev) => {
                    const newValue = ev.target.value || ev.target.entityId || "";
                    this._config = {
                        ...this._config,
                        [f.key]: newValue
                    };
                    this.dispatchEvent(new CustomEvent('config-changed', {
                        detail: { config: this._config },
                        bubbles: true,
                        composed: true
                    }));
                });

                wrapper.appendChild(input);
                container.appendChild(wrapper);
            });
        }
    }
}

customElements.define("printer-monitor-card-editor", PrinterMonitorCardEditor);

class PrinterMonitorCard extends HTMLElement {
    
    static get localizations() {
        return PrinterMonitorCardEditor.localizations;
    }

    _localize(key, lang = this._hass?.language || 'en', vars = {}) {
        const translations = PrinterMonitorCard.localizations;
        let translation = translations[lang]?.[key] || translations['en'][key] || key;
        
        for (const [varKey, varValue] of Object.entries(vars)) {
            translation = translation.replace(`{${varKey}}`, varValue);
        }
        return translation;
    }


    constructor() {
        super();
        this._hass = null;
        this._config = null;
        this._card = null;
    }

    set hass(hass) {
        this._hass = hass;
        if (this._card) this._card.hass = hass;
        else if (this._config) this._renderCard();
    }

    setConfig(config) {
        if (!config.printer || !config.printer_name) {
            const lang = this._hass?.language;
            const error = lang === 'pl' 
                ? 'Musisz zdefiniować "printer" i "printer_name".' 
                : 'You must define "printer" and "printer_name".';
            throw new Error(error);
        }
        this._config = config;
        if (this._hass) this._renderCard();
    }

    getCardSize() { return 5; }

    async _renderCard() {
        if (!this._hass || !this._config) return;
        if (!this._helpers) this._helpers = await window.loadCardHelpers();
        const cardConfig = this._buildCardConfig();

        if (!this._card) {
            this._card = this._helpers.createCardElement(cardConfig);
            this.appendChild(this._card);
        }

        this._card.hass = this._hass;
    }

    _buildCardConfig() {
        const p = this._config.printer;
        const lang = this._hass?.language;
        const printerName = this._config.printer_name;
        
        const confirmationText = this._localize("toggle_confirm", lang, { printer_name: printerName });

        return {
            type: "vertical-stack",
            cards: [
                {
                    type: 'conditional',
                    conditions: [
                        { condition: 'state', entity: `sensor.${p}_current_print_state`, state: 'unavailable' }
                    ],
                    card: {
                        type: 'custom:bubble-card',
                        card_type: 'button',
                        entity: this._config.printer_switch,
                        name: printerName,
                        double_tap_action: { action: 'more-info' },
                        hold_action: { action: 'more-info' },
                        button_action: {
                            tap_action: {
                                action: 'call-service',
                                service: 'script.turn_on',
                                target: { entity_id: this._config.toggle_script }
                            },
                            double_tap_action: { action: 'more-info' }
                        },
                        sub_button: [
                            {
                                entity: `sensor.${p}_current_print_state`,
                                show_icon: false,
                                show_state: true,
                                show_name: false,
                                tap_action: { action: 'none' },
                                visibility: [
                                    {
                                        condition: 'state',
                                        entity: `sensor.${p}_current_print_state`,
                                        state_not: 'unavailable'
                                    }
                                ]
                            }
                        ]
                    }
                },
                {
                    type: 'conditional',
                    conditions: [
                        { condition: 'state', entity: `sensor.${p}_current_print_state`, state_not: 'unavailable' }
                    ],
                    card: {
                        type: 'custom:mod-card',
                        style: `
                            ha-card {
                                --ha-card-background: var(--bubble-button-main-background-color, var(--bubble-main-background-color, var(--background-color-2, var(--secondary-background-color))));
                                --ha-card-border-radius: var(--bubble-button-border-radius, var(--bubble-border-radius, calc(var(--row-height,56px)/2)));
                            }
                        `,
                        card: {
                            type: 'custom:stack-in-card',
                            card_mod: { style: 'ha-card {--ha-card-border-width: 0; --vertical-stack-card-gap: 0px;}' },
                            visibility: [
                                { condition: 'state', entity: `sensor.${p}_current_print_state`, state_not: 'unavailable' }
                            ],
                            cards: [
                                {
                                    type: 'grid',
                                    columns: 2,
                                    square: false,
                                    cards: [
                                        {
                                            type: 'custom:mushroom-template-card',
                                            primary: printerName,
                                            tap_action: { action: 'none' },
                                            hold_action: { action: 'more-info' },
                                            double_tap_action: { action: 'none' },
                                            icon: 'phu:3dprinter-printing',
                                            entity: this._config.printer_switch,

                                            secondary: `{{ state_translated("sensor.${p}_current_print_state") }} • {{ states("sensor.${p}_progress", with_unit=true) }}`,
                                            icon_color: `
                                                {% if states("sensor.${p}_current_print_state") == "printing" %}
                                                    green
                                                {% elif states("sensor.${p}_current_print_state") == "paused" %}
                                                    amber
                                                {% elif states("sensor.${p}_current_print_state") == "stopped" %}
                                                    red
                                                {% else %}
                                                    light-blue
                                                {% endif %}
                                            `
                                        },
                                        {
                                            type: 'grid',
                                            columns: 3,
                                            square: false,
                                            cards: [
                                                { type: 'horizontal-stack', cards: [] },
                                                { type: 'horizontal-stack', cards: [] },
                                                {
                                                    type: 'horizontal-stack',
                                                    cards: [
                                                        {
                                                            type: 'custom:mushroom-entity-card',
                                                            icon: 'mdi:pause',
                                                            icon_color: 'amber',
                                                            entity: `button.${p}_pause_print`,
                                                            layout: 'vertical',
                                                            visibility: [
                                                                { condition: 'state', entity: `sensor.${p}_current_print_state`, state: 'printing' }
                                                            ],
                                                            secondary_info: 'none',
                                                            primary_info: 'none'
                                                        },
                                                        {
                                                            type: 'custom:mushroom-entity-card',
                                                            icon: 'mdi:play',
                                                            icon_color: 'green',
                                                            entity: `button.${p}_resume_print`,
                                                            layout: 'vertical',
                                                            visibility: [
                                                                { condition: 'state', entity: `sensor.${p}_current_print_state`, state: 'paused' }
                                                            ],
                                                            secondary_info: 'none',
                                                            primary_info: 'none'
                                                        },
                                                        {
                                                            type: 'custom:mushroom-entity-card',
                                                            icon: 'mdi:stop',
                                                            icon_color: 'red',
                                                            entity: `button.${p}_cancel_print`,
                                                            layout: 'vertical',
                                                            tap_action: { action: 'none' },
                                                            double_tap_action: { action: 'none' },
                                                            secondary_info: 'none',
                                                            primary_info: 'none',
                                                            visibility: [
                                                                { condition: 'state', entity: `sensor.${p}_current_print_state`, state: 'paused' }
                                                            ]
                                                        },
                                                        {
                                                            type: 'custom:mushroom-entity-card',
                                                            icon: 'mdi:power',
                                                            icon_color: 'red',
                                                            entity: `sensor.${p}_current_print_state`,
                                                            layout: 'vertical',
                                                            tap_action: {
                                                                confirmation: { text: confirmationText },
                                                                action: 'call-service',
                                                                target: { entity_id: this._config.toggle_script },
                                                                service: 'script.turn_on'
                                                            },
                                                            visibility: [
                                                                { 
                                                                    condition: 'not',
                                                                    conditions: [
                                                                        { condition: 'or', conditions: [
                                                                            { condition: 'state', entity: `sensor.${p}_current_print_state`, state: 'printing' },
                                                                            { condition: 'state', entity: `sensor.${p}_current_print_state`, state: 'paused' }
                                                                        ]}
                                                                    ]
                                                                }
                                                            ],
                                                            secondary_info: 'none',
                                                            primary_info: 'none'
                                                        }
                                                    ]
                                                }
                                            ]
                                        }
                                    ]
                                },
                                {
                                    type: 'custom:layout-card',
                                    layout_type: 'grid',
                                    layout: {
                                        "grid-template-columns": "repeat(4, 1fr)",
                                        "grid-template-rows": "repeat(2, auto)",
                                        "grid-template-areas": `"a b b b" "a c c c"`,
                                        width: '100%',
                                        margin: 0,
                                        padding: 0,
                                        justify_items: 'stretch',
                                        align_items: 'stretch'
                                    },
                                    visibility: [
                                        { condition: 'or', conditions: [
                                            { condition: 'state', entity: `sensor.${p}_current_print_state`, state: 'printing' },
                                            { condition: 'state', entity: `sensor.${p}_current_print_state`, state: 'paused' }
                                        ]}
                                    ],
                                    cards: [
                                        {
                                            type: 'picture-entity',
                                            show_state: false,
                                            show_name: false,
                                            tap_action: { action: 'none' },
                                            hold_action: { action: 'none' },
                                            double_tap_action: { action: 'none' },
                                            entity: `camera.${p}_thumbnail`,
                                            camera_image: `camera.${p}_thumbnail`,
                                            view_layout: { 'grid-area': 'a' }
                                        },
                                        {
                                            type: 'custom:mushroom-template-card',
                                            show_icon: false,
                                            view_layout: { 'grid-area': 'b' },
                                            primary: `{{ states("sensor.${p}_filename") }}`,
                                            secondary: `Layer: {{ states("sensor.${p}_current_layer") }} of {{ states("sensor.${p}_total_layer") }}`,
                                            fill_entity: `sensor.${p}_current_layer`,
                                            tap_action: { action: 'none' },
                                            hold_action: { action: 'none' },
                                            double_tap_action: { action: 'none' }
                                        },
                                        {
                                            type: 'custom:entity-progress-card',
                                            view_layout: { 'grid-area': 'c' },
                                            entity: `sensor.${p}_current_layer`,
                                            max_value: `sensor.${p}_total_layer`,
                                            hide: ['icon', 'name', 'value', 'secondary_info'],
                                            disable_unit: true,
                                            bar_size: 'large',
                                            tap_action: { action: 'none' },
                                            hold_action: { action: 'none' },
                                            double_tap_action: { action: 'none' }
                                        }
                                    ]
                                },
                                {
                                    type: 'picture-entity',
                                    show_state: false,
                                    show_name: false,
                                    camera_view: 'live',
                                    entity: this._config.live_camera,
                                    camera_image: this._config.live_camera,
                                    card_mod: { style: `ha-card { transform: rotate(${this._config.live_camera_rotation || 0}deg) !important; transition: none !important; }` }, 
                                    tap_action: { action: 'none' }, 
                                    hold_action: { action: 'none' }, 
                                    double_tap_action: { action: 'none' }
                                },
                                {
                                    type: 'horizontal-stack',
                                    cards: [
                                        {
                                            type: 'custom:mushroom-chips-card',
                                            chips: [
                                                { type: 'entity', entity: `sensor.${p}_print_eta`, tap_action: { action: 'none' }, hold_action: { action: 'none' }, double_tap_action: { action: 'none' } },
                                                { type: 'entity', entity: `sensor.${p}_progress`, icon: 'mdi:chart-donut', tap_action: { action: 'none' }, hold_action: { action: 'none' }, double_tap_action: { action: 'none' } },
                                                { type: 'entity', entity: `sensor.${p}_toolhead_position_z`, icon: 'mdi:gantry-crane', tap_action: { action: 'none' }, hold_action: { action: 'none' }, double_tap_action: { action: 'none' } },
                                                { 
                                                    type: 'entity', entity: `sensor.${p}_fan1`, 
                                                    tap_action: { action: 'none' }, hold_action: { action: 'none' }, double_tap_action: { action: 'none' },
                                                    visibility: [
                                                        { condition: 'state', entity: `sensor.${p}_fan1`, state_not: 'unavailable' }
                                                    ]
                                                },
                                                { 
                                                    type: 'entity', entity: `sensor.${p}_fan2`, 
                                                    tap_action: { action: 'none' }, hold_action: { action: 'none' }, double_tap_action: { action: 'none' },
                                                    visibility: [
                                                        { condition: 'state', entity: `sensor.${p}_fan2`, state_not: 'unavailable' }
                                                    ]
                                                },
                                                { 
                                                    type: 'entity', entity: `sensor.${p}_fan3`, 
                                                    tap_action: { action: 'none' }, hold_action: { action: 'none' }, double_tap_action: { action: 'none' },
                                                    visibility: [
                                                        { condition: 'state', entity: `sensor.${p}_fan3`, state_not: 'unavailable' }
                                                    ]
                                                },
                                                { 
                                                    type: 'entity', entity: `sensor.${p}_fan3`, 
                                                    tap_action: { action: 'none' }, hold_action: { action: 'none' }, double_tap_action: { action: 'none' },
                                                    visibility: [
                                                        { condition: 'state', entity: `sensor.${p}_fan3`, state_not: 'unavailable' }
                                                    ]
                                                },
                                                { 
                                                    type: 'entity', entity: `sensor.${p}_fan_speed`, 
                                                    tap_action: { action: 'none' }, hold_action: { action: 'none' }, double_tap_action: { action: 'none' },
                                                    visibility: [
                                                        { condition: 'state', entity: `sensor.${p}_speed`, state_not: 'unavailable' }
                                                    ]
                                                }
                                            ],
                                            alignment: 'center'
                                        }
                                    ],
                                    visibility: [
                                        { condition: 'or', conditions: [
                                            { condition: 'state', entity: `sensor.${p}_current_print_state`, state: 'printing' },
                                            { condition: 'state', entity: `sensor.${p}_current_print_state`, state: 'paused' }
                                        ]}
                                    ],
                                    alignment: 'center'
                                },
                                {
                                    type: 'horizontal-stack',
                                    cards: [
                                        {
                                            type: 'custom:mushroom-chips-card',
                                            chips: [
                                                { type: 'entity', entity: `sensor.${p}_extruder_temperature`, tap_action: { action: 'none' }, hold_action: { action: 'none' }, double_tap_action: { action: 'none' } },
                                                { type: 'entity', entity: `sensor.${p}_bed_temperature`, icon: 'mdi:chart-donut', tap_action: { action: 'none' }, hold_action: { action: 'none' }, double_tap_action: { action: 'none' } },
                                                { 
                                                    type: 'entity', entity: `sensor.${p}_host_temp`, 
                                                    tap_action: { action: 'none' }, hold_action: { action: 'none' }, double_tap_action: { action: 'none' } ,
                                                    visibility: [
                                                        { condition: 'state', entity: `sensor.${p}_host_temp`, state_not: 'unavailable' }
                                                    ]
                                                },
                                                { 
                                                    type: 'entity', entity: `sensor.${p}_raspberry_pi_temp`, 
                                                    tap_action: { action: 'none' }, hold_action: { action: 'none' }, double_tap_action: { action: 'none' },
                                                    visibility: [
                                                        { condition: 'state', entity: `sensor.${p}_raspberry_pi_temp`, state_not: 'unavailable' }
                                                    ]
                                                }
                                            ],
                                            alignment: 'center'
                                        }
                                    ],
                                    alignment: 'center'
                                }
                            ]
                        }
                    }
                }
            ]
        };
    }

    static getStubConfig() {
        return {
            printer_name: "My Printer",
            printer: "my_printer",
            live_camera: "camera.my_printer",
            live_camera_rotation: 0,
            printer_switch: "switch.my_printer",
            toggle_script: "script.my_printer_toggle"
        };
    }

    static async getConfigElement() {
        if (typeof customElements.get('ha-entity-picker') === 'undefined') {
            const help = await window.loadCardHelpers();
            await help.createCardElement({ type: 'entity' }); 
        }

        return document.createElement("printer-monitor-card-editor");
    }
}

customElements.define("printer-monitor-card", PrinterMonitorCard);

window.customCards = window.customCards || [];
window.customCards.push({
    type: "printer-monitor-card",
    name: "Printer Monitor Card",
    description: "3D printer status card with live camera, progress and conditional cards",
    preview: true
});

console.info("%c PRINTER-MONITOR-CARD loaded", "color: white; background: #4caf50; padding: 4px;");