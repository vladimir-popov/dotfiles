# pi-nvim

<p align="center">
  <img src="assets/pi-nvim.png" alt="Pi running in Neovim" height="300" />
</p>

**Keep Pi close while you code.** `pi-nvim` connects Neovim to [Pi](https://pi.dev/) with a managed terminal and a
lightweight companion extension—no elaborate IDE integration, just a simple bridge between your editor and your AI
session. Send selected text to Pi as context, and open files it mentions or changes without leaving Neovim. One command
to bring Pi into your workflow; your editor stays yours.

## Requirements

- Neovim 0.10 or newer.
- Pi installed and available as `pi` on `PATH`, or a custom Pi command configured below.
- The `pi-nvim` companion extension loaded by Pi. The extension uses Pi's interactive editor API.

## Installation and setup

### Install with Neovim's built-in package support

Clone the repository into Neovim's `start` package directory so it is loaded automatically:

```sh
mkdir -p ~/.local/share/nvim/site/pack/plugins/start
git clone https://github.com/vladimir-popov/pi-nvim \\
  ~/.local/share/nvim/site/pack/plugins/start/pi-nvim
```

If Neovim uses a custom data directory, put the repository under that directory's `site/pack/plugins/start/` instead.

Add the setup call to your `init.lua`:

```lua
require("pi_nvim").setup()
```

### Install with lazy.nvim

Add this plugin specification to your lazy.nvim setup:

```lua
{
    "vladimir-popov/pi-nvim",
    keys = {
        { "<leader>pi", "<cmd>Pi<cr>", desc = "Open or focus Pi" },
        { "<leader>pi", "<C-\\><C-n><cmd>Pi<cr>", mode = "t", desc = "Return from Pi" },
        { "<leader>pi", ":<C-U>'<,'>Pi<CR>", mode = "x", desc = "Send selection to Pi" },
        { "<leader>pr", "<cmd>PiReferences<cr>", desc = "Open Pi references" },
    }
}
```

### Configure the Pi extension

To enable the companion extension, add its entry point to the `extensions` list in `~/.pi/agent/settings.json`. Use the
path where your plugin manager installed the repository. For example, with the default install locations:

- Built-in package support: `~/.local/share/nvim/site/pack/plugins/start/pi-nvim/pi/index.ts`
- lazy.nvim: `~/.local/share/nvim/lazy/pi-nvim/pi/index.ts`

```json
{
  "extensions": [
    "~/.local/share/nvim/lazy/pi-nvim/pi/index.ts"
  ]
}
```

Choose the path matching your installation and merge the entry into an existing `extensions` list rather than replacing
other configured extensions. If you customized Neovim's data directory or lazy.nvim's install directory, use the
corresponding path instead. The root `package.json` declares `pi/index.ts` as this project's extension entry point.

## Configuration

```lua
require("pi_nvim").setup({
    position = "tab", -- Where to open Pi: "tab", "horizontal", or "vertical".
    command = "pi", -- Pi executable; use an argument list to pass extra Pi CLI options.
    provider = nil, -- Optional initial provider; requires `model` when set.
    model = nil, -- Optional initial model; can be set without `provider`.
    cwd = nil, -- Pi working directory; nil uses Neovim's current directory.
})
```

The `nil` options are shown for completeness and can be omitted. You can also
pass `--provider` and `--model` directly through `command`, for example as
`{ "pi", "--provider", "provider-id", "--model", "model-id" }`. The `provider`
and `model` options add these arguments automatically; do not specify the same
option in both places.

## Usage

- Run `:Pi` to open or focus Pi; from the Pi terminal, run `:Pi` again to return to the window you came from. The
  terminal opens in a new tab by default. When the terminal window is closed, its managed process and terminal buffer
  are cleaned up.
- Run `:Pi <prompt>` to put the prompt into Pi's input and focus the terminal. In Visual mode, `:Pi <prompt>` also
  appends the selected text and source location as context. The prompt and selection are inserted but not submitted;
  press Enter in Pi when ready. Selection transfer includes the source and line range: named file buffers are
  identified as files, while special or unnamed buffers are identified as buffers by name. An unnamed buffer is
  labeled with its buffer number. Run `:Pi` in Visual mode to transfer a selection without an initial prompt.
- After a completed assistant response without tool results, recognized file references replace the entries in the **Pi
  References** quickfix list. The list does not open automatically. Run `:PiReferences` to open it; press Enter on an
  entry to visit the file and line.

Reference formats initially recognized are `path:line` and Markdown file links. Relative paths are resolved against Pi's
working directory; a link without a line targets line 1. A response with no recognized references clears the prior Pi
References entries.

## Troubleshooting and limitations

- If prompt or selection transfer is unavailable, ensure Pi loaded the `pi/index.ts` extension from your plugin
  installation and check Pi startup output for extension errors. Neovim warns if the extension does not answer its
  startup readiness probe.
- Prompts and selections are inserted into the interactive Pi editor; they are not submitted and do not start a response
  until you press Enter in Pi.
- Selection transfer and reference updates require the companion extension and an interactive Pi session. The bridge
  uses per-session Unix-domain sockets under `/tmp`; it is not intended for a remote Pi process.
- Reference parsing is limited to `path:line` and Markdown file links. It does not recognize Vim help tags or arbitrary
  reference formats.

## Neovim help

See [`doc/pi-nvim.txt`](doc/pi-nvim.txt), or open `:help pi-nvim` after adding this project to Neovim's runtime path.
