import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShippingSettings } from "@/modules/fundament/public";

const ports = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn() }));
vi.mock("@/app/actions/settings.actions", () => ({ readShippingSettingsAction: ports.read, saveShippingSettingsAction: ports.save }));
import { ShippingSettingsEditor } from "../ShippingSettingsEditor";

const stored: ShippingSettings = { service: "SYNTHETISCH Versand", numberPattern: "^S[0-9]{6}$", numberHint: "S und sechs Ziffern", trackingUrl: "https://example.invalid/{nr}", labelApi: null, updatedAt: "2026-11-05T12:00:00.000000Z" };
beforeEach(() => { vi.resetAllMocks(); ports.read.mockResolvedValue({ code: "OK", settings: stored }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const service = () => screen.getByLabelText("Versanddienst");
const saveButton = () => screen.getByRole("button", { name: "Versandangaben speichern" });

describe("Shipping settings UI connects to the existing versioned Action", () => {
  it("advances through the four fields on Enter and saves only at the final field", async () => {
    ports.save.mockResolvedValue({ code: "OK", settings: stored, replayed: true });
    render(<ShippingSettingsEditor />); await screen.findByDisplayValue(stored.service);
    const inputs = [service(), screen.getByLabelText("Format der Sendungsnummer"), screen.getByLabelText("Hinweis zur Sendungsnummer"), screen.getByLabelText("Sendungsverfolgung (HTTPS-Adresse mit {nr})")];
    for (let index = 0; index < inputs.length - 1; index++) {
      fireEvent.keyDown(inputs[index], { key: "Enter" }); expect(inputs[index + 1]).toHaveFocus(); expect(ports.save).not.toHaveBeenCalled();
    }
    fireEvent.keyDown(inputs.at(-1)!, { key: "Enter" });
    expect(await screen.findByText("Versandangaben gespeichert.")).toBeVisible(); expect(ports.save).toHaveBeenCalledTimes(1);
  });

  it("reads the stored configuration, sends one versioned write on double click and confirms only after a new read", async () => {
    let finish!: (value: unknown) => void;
    ports.save.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<ShippingSettingsEditor />);
    expect(await screen.findByDisplayValue(stored.service)).toBeVisible();
    expect(ports.save).not.toHaveBeenCalled();
    fireEvent.change(service(), { target: { value: "SYNTHETISCH Neuer Versand" } });
    const button = saveButton(); fireEvent.click(button); fireEvent.click(button);
    expect(ports.save).toHaveBeenCalledTimes(1);
    expect(ports.save).toHaveBeenCalledWith({ service: "SYNTHETISCH Neuer Versand", numberPattern: stored.numberPattern, numberHint: stored.numberHint, trackingUrl: stored.trackingUrl, expectedUpdatedAt: stored.updatedAt });
    expect(screen.queryByText("Versandangaben gespeichert.")).toBeNull();
    const changed = { ...stored, service: "SYNTHETISCH Neuer Versand", updatedAt: "2026-11-05T12:01:00.000000Z" };
    ports.read.mockResolvedValue({ code: "OK", settings: changed });
    await act(async () => { finish({ code: "OK", settings: changed, replayed: false }); });
    expect(await screen.findByText("Versandangaben gespeichert.")).toBeVisible();
    expect(ports.read).toHaveBeenCalledTimes(2);
  });

  it("keeps typed values on a conflict and requires an explicit comparison before using the current version", async () => {
    const current = { ...stored, numberHint: "SYNTHETISCH fremde Änderung", updatedAt: "2026-11-05T12:02:00.000000Z" };
    ports.save.mockResolvedValue({ code: "CONFLICT", message: "Versandangaben wurden inzwischen geändert. Bitte abgleichen.", current });
    render(<ShippingSettingsEditor />); await screen.findByDisplayValue(stored.service);
    fireEvent.change(service(), { target: { value: "SYNTHETISCH Eigene Eingabe" } }); fireEvent.click(saveButton());
    expect(await screen.findByRole("region", { name: "Geänderter Versandstand" })).toHaveTextContent(current.numberHint);
    expect(service()).toHaveValue("SYNTHETISCH Eigene Eingabe"); expect(saveButton()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Meine Eingaben nach Abgleich beibehalten" }));
    expect(service()).toHaveValue("SYNTHETISCH Eigene Eingabe"); expect(ports.save).toHaveBeenCalledTimes(1);
    fireEvent.click(saveButton()); await waitFor(() => expect(ports.save).toHaveBeenCalledTimes(2));
    expect(ports.save.mock.calls[1][0]).toMatchObject({ service: "SYNTHETISCH Eigene Eingabe", expectedUpdatedAt: current.updatedAt });
  });

  it("retains the same input/version after a transport failure and logs a visible error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    ports.save.mockRejectedValue(new Error("SYNTHETISCH Transport unterbrochen"));
    render(<ShippingSettingsEditor />); await screen.findByDisplayValue(stored.service);
    fireEvent.change(service(), { target: { value: "SYNTHETISCH Wiederholen" } }); fireEvent.click(saveButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("SHIPPING_EDITOR_WRITE_FAILED");
    expect(service()).toHaveValue("SYNTHETISCH Wiederholen"); expect(log).toHaveBeenCalledWith("[SHIPPING_EDITOR_WRITE_FAILED]", expect.any(Error));
    fireEvent.click(saveButton()); await waitFor(() => expect(ports.save).toHaveBeenCalledTimes(2));
    expect(ports.save.mock.calls[1][0]).toEqual(ports.save.mock.calls[0][0]);
  });

  it("shows a denied read and retries that read without exposing empty replacement settings or writing", async () => {
    ports.read.mockResolvedValueOnce({ code: "FORBIDDEN", message: "Versandangaben sind nicht freigegeben." });
    render(<ShippingSettingsEditor />);
    expect(await screen.findByRole("alert")).toHaveTextContent("nicht freigegeben");
    expect(screen.queryByLabelText("Versanddienst")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Versandangaben erneut lesen" }));
    expect(await screen.findByDisplayValue(stored.service)).toBeVisible(); expect(ports.save).not.toHaveBeenCalled();
  });
});
