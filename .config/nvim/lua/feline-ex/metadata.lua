------------------------------------------------------------------
-- This script contains EmmyLua Annotations for all used types. --
------------------------------------------------------------------

---@alias LspClient table #an object which returns from the `vim.lsp.client()`.

---@alias DevIcon table #an object which returns from the 'nvim-web-devicons' module.

---@alias Color string # a name of the color or RGB hex color description

---@alias Highlight string|table|function # a description of the highlight according to the |feline-Component-highlight|.

---@alias Provider string|table|function

---@class Icon
---@field str string
---@field hl Highlight
---@field always_visible boolean

---@class FelineComponent # see complete description here: |feline-components|
---@field name string
---@field provider Provider
---@field opts any
---@field hl Highlight
---@field icon string|Icon|function
---@field enabled boolean

---@class FelineSetup # see |feline-setup-function|
---@field components table
---@field conditional_components table
---@field custom_providers table
---@field theme string|table
---@field separators table
---@field force_inactive table

---@class Component : FelineComponent
---@field component string # a name of the existing component which will be used as a prototype.
---@field hls table<string, Highlight> # custom highlights for the component.

---@alias Section Component[]

---@alias Theme table<string, string> # key - name of a color; value - RGB hex color description

---@class Library # library of reusable components.
---@field components table<string, Component>
---@field providers  table<string, Provider>
---@field highlights table<string, Highlight>
---@field icons      table<string, Icon>

---@class Statusline
---@field active_components     Section[]               list of sections with components for an active window.
---@field inactive_components   Section[]               list of sections with components for an inactive window.
---@field themes                table<string, Theme>    table with existed temes.
---@field vi_mode_colors        table<string, Color>
---@field lib                   Library
