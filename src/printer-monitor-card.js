/* Orginal author: Grzegorz Russek
   MIT License */
console.info("%c PRINTER-MONITOR-CARD loading", "color: white; background: #4caf50; padding: 4px;");

class PrinterMonitorCardEditor extends HTMLElement {
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
        return [
            { key: "printer_name", label: "1. Nazwa drukarki (Printer name)", type: "text" },
            { key: "printer", label: "2. Prefiks encji (Entity prefix, np. 'tevo_tarantula')", type: "text" },
            { key: "printer_switch", label: "3. Włącznik drukarki (Switch)", type: "entity", domain: "switch" },
            { key: "toggle_script", label: "4. Skrypt włącz/wyłącz (Toggle Script)", type: "script", domain: "script" }, 
            { key: "live_camera", label: "5. Kamera na żywo (Live camera - Opcj.)", type: "entity", domain: "camera" },
            { key: "live_camera_rotation", label: "6. Obrót kamery (Rotation - Opcj.)", type: "number", min: 0, max: 360, step: 1, default: 0 },
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
            
            const container = document.createElement("div");
            container.innerHTML = '<h4>Konfiguracja Drukarki (Prefix + Jawne Encje)</h4>';
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
                    input.placeholder = `entity_id.${f.domain} (Opcjonalnie)`;

                    input.title = `Wprowadź Entity ID, np. ${f.domain}.moj_sprzet`;
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
      throw new Error('Musisz zdefiniować "printer" i "printer_name".');
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
            name: this._config.printer_name,
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
                      primary: this._config.printer_name,
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
                                confirmation: { text: `Czy na pewno chcesz włączyć/wyłączyć drukarkę ${this._config.printer_name}?` },
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
                        { type: 'entity', entity: `sensor.${p}_fan1`, tap_action: { action: 'none' }, hold_action: { action: 'none' }, double_tap_action: { action: 'none' } }
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