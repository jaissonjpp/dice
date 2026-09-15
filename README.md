# Rolador de Dados (Dice Roller)

Aplicação web estática para rolagem de dados de RPG com suporte a dados poliédricos e motor de regras para o sistema **3ª Edição (Revised)** de *Vampiro: A Máscara*.

## Funcionalidades

* **Dados Suportados**: d4, d6, d8, d10, d12, d20 e d100.
* **Pool de Dados**: até 100 dados por tipo com digitação direta da quantidade ou botões `+`/`−` (<kbd>Shift</kbd> + Clique para passos de 5).

* **Favoritos (Presets)**: salva e carrega combinações pré-definidas de dados e dificuldade (ex.: *Ataque de Garras: 7d10 (Dif. 6)*, *Dano de Espada: 1d8 + 1d6*).
* **Histórico**: armazena as últimas 100 rolagens com horário, dados rolados e resultado.
* **Modo Vampiro**:
  * Restringe o pool apenas para d10.
  * Seletor de dificuldade de 2 a 10.
  * Contagem de sucessos (valores >= dificuldade).
  * Cancelamento de sucessos por dados com valor 1.
  * Detecção de sucessos no 10.
  * Detecção de Falha Crítica (quando não há sucessos e há pelo menos um 1).
## Características da Implementação

* **RNG Criptográfico (CSPRNG)**: utiliza `crypto.getRandomValues()` com rejeição de viés de módulo para distribuição estatística uniforme (fallback para `Math.random()`).
* **Persistência Local**: presets e histórico salvos no `localStorage` do navegador.

## Execução

### Online
Acesse diretamente via GitHub Pages:  
 **https://jaissonjpp.github.io/dice/**

### Local
Clone ou baixe o repositório e abra o arquivo `index.html` no navegador, ou execute um servidor local:

```bash
git clone https://github.com/jaissonjpp/dice.git
cd dice
npx serve .
```
