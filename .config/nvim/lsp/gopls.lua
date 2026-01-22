return {
    cmd = { "gopls" },
    filetypes = { "go", "gomod", "gowork", "gotmpl" },
    root_markers = { "go.mod", "go.sum", "go.work" },
    settings = {
        gopls = {
            analyses = {
                unusedparams = true,
                shadow = true,
                undeclarednames = true,
            },
            staticcheck = true,
            usePlaceholders = true,
        },
    },
}
