# Dotfiles


## Preparation

Some dotfiles need additional tools and preparations. Before applying dotfiles some additional tools must be installed:

Install the brew itself:
```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Install all other apps, go br....
```sh
# Alacritty
brew install --cask alacritty

# Tmux
brew install tmux
# To reattach process (e.g., tmux) to background, the follow should be installed:
brew install reattach-to-user-namespace
# Install plugin manager and then install plugins: <C-b>I
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm

# Git
brew install git
brew install lazygit

# Nerd fonts
brew tap homebrew/cask-fonts
brew install --cask font-fira-code-nerd-font

# Neovim
brew install neovim

# fzf
brew install fzf

# ag
brew install ag

# nnn
brew install nnn

# nnn plugins
sh -c "$(curl -Ls https://raw.githubusercontent.com/jarun/nnn/master/plugins/getplugs)"

# delta
brew install git-delta
```

### Add public key to github

```sh
ssh-keygen -t ed25519 -C "vladimir@dokwork.ru"
tr -d '\n' < ~/.ssh/id_ed25519.pub | pbcopy
```
and put the public key from the clipboard here: https://github.com/settings/keys

### Oh My Zsh

```sh
sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
```

## Apply dotfiles 

To apply dotfiles to a new machine:

1. In the new sh session create alias:
```sh
alias dot='git --git-dir=$HOME/.git_dot/ --work-tree=$HOME'
```

2. Clone this repo:
```sh 
git clone --bare git@github.com:vladimir-popov/dotfiles.git $HOME/.git_dot
```

3. Checkout repo to the $HOME directory:
```sh
cd ~
dot checkout
```

4. Set the flag showUntrackedFiles to no on this specific (local) repository:
```sh
dot config --local status.showUntrackedFiles no
```

_Thanks Atlassian for the advice https://www.atlassian.com/git/tutorials/dotfiles_

## Vital apps

```sh
# Tool to reverse the direction of scrolling
brew install --cask scroll-reverser

# Clipboard manager
brew install --cask clipy

# Passwords manager
brew install --cask keepassx

# Docker
brew install docker
brew install colima

# Windows manager
brew install --cask spectacle

# Telegram
brew install telegram

# Spotify
brew install spotify
```

## Dev apps

### Lua

```sh
brew install lua-language-server
brew install stylua
```


### Scala

```sh
brew install coursier/formulas/coursier
cs java --jvm 17 --setup
cs setup
```

### C

```sh
brew install gcc
```

### Json, Markdown, Html and CSS
```sh
npm i -g vscode-langservers-extracted
```
