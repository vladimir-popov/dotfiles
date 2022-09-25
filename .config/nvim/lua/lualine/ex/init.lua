local M = {}

---@alias RGB string RGB hex color description

---@alias Color string | RGB # a name of the color or RGB

---@alias HighlightGroup string a name of the highlight group

---@alias StatuslineHighlight string `%#<HighlightGroup>#`

---@class Highlight highlight definition map. See :help nvim_set_hl
---@field fg Color
---@field bg Color

---@class LualineHighlight any table identifier received from create_hl or create_component_highlight_group
---@field name HighlightGroup
---@field no_mode boolean
---@field section string
---@field options LualineComponentOptions
---@field no_default boolean

---@class DevIcon An object which returns from the 'nvim-web-devicons' module.
---@field icon string
---@field color Color
---@field name string
---@field cterm_color string
---
---DevIcon example:
---```lua
---{
---   icon = "",
---   color = "#51a0cf",
---   cterm_color = "74",
---   name = "Lua",
---}
---```

---@class Object
---@field new fun(...)
---@field init fun(...)

---@alias Aligns
---| '"left"'
---| '"right"'

---@class LualineIcon
---@field align Aligns
---@field color { fg: Color }

---@alias Icon string | LualineIcon

---@class LualineComponentOptions
---@field self table
---@field component_name string
---@field color Color
---@field icon Icon
---@field cond fun(): boolean
---@field fmt fun(status: string): string
---@field icons_enabled boolean
---@field icon_color_highlight LualineHighlight table identifier received from create_hl or create_component_highlight_group

---@class LualineComponent: Object
---@field super Object
---@field self LualineComponent
---@field status string
---@field options LualineComponentOptions
---@field init fun(options: LualineComponentOptions)
---@field create_option_highlights fun()
---@field create_hl fun(color: table|string|function, hint?: string): table
---@field update_status fun(is_focused: boolean)
---@field apply_icon fun()
---@field apply_padding fun()
---@field apply_on_click fun()
---@field apply_higlights fun(default_highlight: LualineHighlight)
---@field apply_section_separators fun()
---@field apply_separator fun()

---@type fun(x: any): boolean
---Checks is an argument {x} is empty.
---
---@return boolean #true when the argument is empty.
---The argument is empty when:
---* it is the nil;
---* it has a type 'table' and doesn't have any pair;
---* it has a type 'string' and doesn't have any char;
---otherwise result is false.
M.is_empty = function(x)
    if x == nil then
        return true
    end
    if type(x) == 'table' and next(x) == nil then
        return true
    end
    if type(x) == 'string' and string.len(x) < 1 then
        return true
    end
    return false
end

---@type fun(t1: table, t2: table): table
---The same as `vim.tbl_extend('keep', t1 or {}, t2 or {})`
M.merge = function(t1, t2)
    return vim.tbl_extend('keep', t1 or {}, t2 or {})
end

---@type fun(t1: table, t2: table): table
---The same as `vim.tbl_deep_extend('keep', t1 or {}, t2 or {})`
M.deep_merge = function(t1, t2)
    return vim.tbl_deep_extend('keep', t1 or {}, t2 or {})
end

return M
