local M = {}

-- {what} - 'fg' to take a foreground color; 'bg' to take a background color.
M.resolve_color = function(color_or_hg, what)
    if color_or_hg:sub(1, 1) == '#' then
        return color_or_hg
    end

    local hl = vim.api.nvim_get_hl_by_name(color_or_hg, true)
    if what == 'fg' then
        what = 'foreground'
    else
        what = 'background'
    end

    return hl[what] and string.format('#%06x', hl[what])
end

M.nightfox = {
    -- colors --
    yellow = '#e5c07b',
    cyan = '#56b6c2',
    grey = '#5c6370',
    green = '#79a15c',
    orange = '#e8a561',
    purple = '#5d4d7a',
    magenta = '#c678dd',
    blue = '#61afef',
    red = '#e06c75',
    black = '#000000',
    white = '#abb2bf',
    oceanblue = '#45707a',
    violet = '#d3869b',
    skyblue = '#7daea3',

    -- special colors --
    -- fg = "#61afef",
    fg = M.resolve_color('Function', 'fg'),
    fg2 = M.resolve_color('Identifier', 'fg'),
    bg = '#282c34',
    sep = M.resolve_color('Delimiter', 'fg'),
    -- bg = resolve_color("Statusline", "bg"),
    -- inactive = "#565c69",
    inactive = M.resolve_color('Whitespace', 'fg'),
    -- opaq = resolve_color("Ignore", "bg"),
    error = M.resolve_color('ErrorMsg', 'fg'),
    warn = M.resolve_color('WarningMsg', 'fg'),
    info = '#61afef',
    ok = '#79a15c',

    -- vi mode colors --
    vi_mode_colors = {
        NORMAL = 'blue',
        OP = 'magenta',
        INSERT = 'green',
        VISUAL = 'magenta',
        LINES = 'magenta',
        BLOCK = 'magenta',
        REPLACE = 'violet',
        ['V-REPLACE'] = 'pink',
        ENTER = 'cyan',
        MORE = 'cyan',
        SELECT = 'orange',
        COMMAND = 'yellow',
        SHELL = 'yellow',
        TERM = 'orange',
        NONE = 'yellow',
    },
}

return M
