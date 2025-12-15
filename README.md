# Printer Monitoring Card

Simple card for monitoring klipper based printers in Home Assistant.
It provides ability to view image from camera, some basic stats and print progress. You can pause/resume/stop prints.
If printer is not printing, power down button is visible. You also can access switch by long pressing on printer name in case of emergency.

![readme-image](https://github.com/GrzegorzRussek/ha-moonraker-printer-monitoring-card/blob/main/img/sample.png?raw=true)

# Assumptions

## Dependencies
This card assimes that you have installedfollowing hacks components:

- [Bubble-Card](https://github.com/Clooos/Bubble-Card/)
- [Mushroom](https://github.com/piitaya/lovelace-mushroom/)
- [Stack In Card](https://github.com/custom-cards/stack-in-card/)
- [Entity Progress Card](https://github.com/francois-le-ko4la/lovelace-entity-progress-card)
- [card-mod](https://github.com/thomasloven/lovelace-card-mod/tree/v4.1.0)
- mod-card

## Setup requirements
- Your printer must be connected to smart outlet/plug/relay that realay shoult be provided as `printer_switch`.
- You have to have a toggle script to safely power down your printer, this script should be passed to the `toggle_script`.
- Monraker entities will be combined based on `printer` parameter to figure out the rest.

# Installation

- Put `printer-monitor-card.js` somwhere in you `www` directory in Home Assistant
- Add a resource in settings (dashboards)

# Example usage

## Sample Toggle Script:
```yaml
alias: Sovol SV08 - Toggle
icon: phu:3dprinter-printing
sequence:
  - choose:
      - conditions:
          - condition: state
            entity_id: switch.printers_socket_3
            state: "off"
        sequence:
          - target:
              entity_id: switch.printers_socket_3
            action: switch.turn_on
            data: {}
          - stop: true
  - condition: state
    entity_id: switch.printers_socket_3
    state: "on"
  - wait_template: |
      {{ states('sensor.sovol_sv08_extruder_temperature') == 'unavailable' or
         (states('sensor.sovol_sv08_extruder_temperature') | float < 100) }}
    timeout: "00:30:00"
    continue_on_timeout: true
  - condition: template
    value_template: |
      {{ states('button.sovol_sv08_host_shutdown') != 'unavailable' }}
  - target:
      entity_id: button.sovol_sv08_host_shutdown
    action: button.press
    data: {}
  - wait_template: |
      {{ is_state('button.sovol_sv08_host_shutdown', 'unavailable') }}
    timeout: "00:05:00"
    continue_on_timeout: true
  - delay:
      hours: 0
      minutes: 1
      seconds: 0
      milliseconds: 0
  - target:
      entity_id: switch.printers_socket_3
    action: switch.turn_off
    data: {}
mode: single
description: ""
```

## Card:
```yaml
type: custom:printer-monitor-card
printer_name: Sovol SV08
printer: sovol_sv08
live_camera: camera.sovol_sv08_sovol
live_camera_rotation: 0
printer_switch: switch.printers_socket_3
toggle_script: script.sovol_sv08_toggle
```

# Known Issues

## Buttons alignment
Resume/Puse/Stop/Power buttons are aligned to the right side using dodgy concept of adding horizontal stacks... This results in some squashing when there are two buttons visible.

## Timing
When toggling printer script printer needs some time to buut up and be availiable in HA, so til then same button is displayed, but with active color (which is normal for bubble card). Same applies when shutting down printer. Preview is visible untill state entity is availiable.

## Editor
Well some sort of editor is added, but... it's better to use yaml anyway