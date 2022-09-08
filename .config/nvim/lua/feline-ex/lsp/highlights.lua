local u = require('feline-ex.utils')
u = u.merge(u, require('feline-ex.lsp.utils'))

local M = {}

---@type fun(hls: table<string, Highlight>): Highlight
---Returns a highlight according to the first attached lsp client.
---The color will be taken from the 'nvim-web-devicons' or 'hls.fg' will be used. If no one
---client is attached, then 'hls.client_off' will be used as foreground color.
---
---@param hls table<string, Highlight> # custom highlights with possible properties:
--- * `unknown` a highlight which will be used if a color for the attached lsp
---             client is not found;
--- * `client_off` a highlight which will be used if no one lsp client is attached;
---
---@return Highlight # highlight for the first attached lsp client.
M.lsp_client = function(cmp)
    local hls = u.merge(cmp and cmp.hls, {
        unknown = 'fg',
        client_off = 'grey',
    })
    local client = u.lsp_client()
    local icon = u.lsp_client_icon({}, client)
    return {
        fg = (u.is_lsp_client_ready(client) and (icon and icon.color) or (icon and hls.unknown))
            or hls.client_off,
    }
end

return M
