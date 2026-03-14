return {
    cmd = { "tinymist" },
    filetypes = { "typst" },
    settings = {
        formatterMode = "typstyle", -- or "typstfmt"
        formatterProseWrap = true,  -- wrap lines in content mode
        formatterPrintWidth = 120,  -- limit line length to 120 if possible
        formatterIndentSize = 4,    -- indentation width
    }
}
