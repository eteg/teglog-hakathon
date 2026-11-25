import { describe, expect, it } from "vitest";

import { containsPii, maskPii, unmaskPii } from "@/lib/pii";

describe("maskPii", () => {
  it.each([
    ["CPF formatado", "meu CPF é 529.982.247-25", "meu CPF é [CPF_1]"],
    ["CPF só dígitos", "cpf 52998224725 ok", "cpf [CPF_1] ok"],
    ["telefone com DDD", "liga no (11) 98765-4321", "liga no [TELEFONE_1]"],
    ["telefone com DDI", "contato +55 11 98765-4321", "contato [TELEFONE_1]"],
    ["placa Mercosul", "caminhão ABC1D23 parado", "caminhão [PLACA_1] parado"],
    ["placa antiga", "placa ABC-1234", "placa [PLACA_1]"],
    ["e-mail", "escreve para joao.silva@exemplo.com.br", "escreve para [EMAIL_1]"],
  ])("%s", (_d, input, expected) => {
    expect(maskPii(input).masked).toBe(expected);
  });

  it.each([
    ["NF de 9 dígitos", "NF 000123456"],
    ["CNPJ formatado", "CNPJ 12.345.678/0001-95"],
    ["CNPJ só dígitos", "CNPJ 12345678000195"],
    ["CEP", "CEP 01310-100"],
    ["CPF com dígito errado", "529.982.247-26"],
    ["chave de NF-e", "35261112345678000195550010000123451000123456"],
    ["valor", "R$ 18.450,00"],
  ])("não mascara %s", (_d, input) => {
    expect(maskPii(input).masked).toBe(input);
  });

  it("same value gets the same placeholder and the map restores the text", () => {
    const text = "CPF 529.982.247-25, repito 529.982.247-25, fone (11) 98765-4321";
    const { masked, map } = maskPii(text);
    expect(masked).toBe("CPF [CPF_1], repito [CPF_1], fone [TELEFONE_1]");
    expect(unmaskPii(masked, map)).toBe(text);
    expect(containsPii(masked)).toBe(false);
  });

  it("continues numbering from an existing map", () => {
    const first = maskPii("placa ABC1D23");
    expect(maskPii("outra placa XYZ9K87", first.map).masked).toBe("outra placa [PLACA_2]");
  });
});
