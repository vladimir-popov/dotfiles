return {
    'vladimir-popov/gemini.nvim',
    dev = true,
    event = "VeryLazy",
    opts = {
        hints = {
            enabled = false
        },
        completion = {
            enabled = false
        },
        instruction = {
            enabled = false
        },
        chat_config = {
            window = {
                position = "right",
                width = 80,
            }
        }
    },
    keys = {
        {
            '<space>gm',
            ':GeminiChat ',
            desc = 'Start chat with Gemini',
        },
    }
}
