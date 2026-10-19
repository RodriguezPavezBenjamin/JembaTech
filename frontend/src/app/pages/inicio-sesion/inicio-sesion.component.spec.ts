import 'zone.js';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { AuthService } from '../../servicios/autenticacion.service';
import { InicioSesionComponent } from './inicio-sesion.component';

describe('Acceso compacto JembaTech', () => {
  const user = { id: 'qa', name: 'QA', email: 'qa@example.invalid', phone: '12345678', role: 'CLIENT' as const };
  const session = { accessToken: 'qa-session', user };
  const auth = {
    google: { prepare: vi.fn(), nativePlatform: false },
    login: vi.fn(), register: vi.fn(), loginGoogle: vi.fn(),
  };
  let fixture: ComponentFixture<InicioSesionComponent>;
  let component: InicioSesionComponent;
  let navigate: MockInstance<Router['navigateByUrl']>;
  const route = { snapshot: { queryParamMap: convertToParamMap({}) } };

  beforeEach(async () => {
    auth.google.nativePlatform = false;
    auth.google.prepare.mockReset().mockResolvedValue(true);
    auth.login.mockReset().mockReturnValue(of(session));
    auth.register.mockReset().mockReturnValue(of(session));
    auth.loginGoogle.mockReset().mockReturnValue(of(session));
    route.snapshot.queryParamMap = convertToParamMap({});
    TestBed.configureTestingModule({
      imports: [InicioSesionComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }, { provide: ActivatedRoute, useValue: route }],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(InicioSesionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });
  afterEach(() => { fixture.destroy(); vi.restoreAllMocks(); });

  const fillLogin = () => component.formulario.patchValue({ correo: user.email, contrasena: 'password-qa' });

  it('muestra etiquetas, dos modos y solo el proveedor Google disponible', () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('label[for="acceso-correo"]')?.textContent).toContain('Correo');
    expect(element.querySelectorAll('.modos button')).toHaveLength(2);
    expect(element.querySelector('.boton-google')?.textContent).toContain('Continuar con Google');
    expect(element.textContent).not.toContain('Apple');
    expect(element.textContent).not.toContain('¿Olvidaste');
    expect(element.querySelector('.cerrar')?.getAttribute('href')).toBe('/');
  });

  it('entrar con correo lleva al menú principal y avisa al encabezado', () => {
    const event = vi.fn();
    window.addEventListener('jembatech-auth-change', event, { once: true });
    fillLogin();
    component.enviar();
    expect(auth.login).toHaveBeenCalledWith({ email: user.email, password: 'password-qa' });
    expect(navigate).toHaveBeenCalledWith('/');
    expect(event.mock.calls[0][0].detail).toEqual(user);
  });

  it('registrarse valida nombre, WhatsApp y contraseña antes de volver al inicio', () => {
    component.cambiarModo('registro');
    fillLogin();
    component.enviar();
    expect(auth.register).not.toHaveBeenCalled();
    component.formulario.patchValue({ nombre: user.name, telefono: user.phone });
    component.enviar();
    expect(auth.register).toHaveBeenCalledWith({ name: user.name, email: user.email, phone: user.phone, password: 'password-qa' });
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('Google no exige rellenar el formulario local y también vuelve al inicio', () => {
    component.ingresarGoogle();
    expect(auth.loginGoogle).toHaveBeenCalledOnce();
    expect(auth.login).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it.each(['local', 'google'])('conserva el armado al iniciar desde el cotizador: %s', method => {
    route.snapshot.queryParamMap = convertToParamMap({ returnUrl: '/#cotizador' });
    fillLogin();
    if (method === 'google') component.ingresarGoogle(); else component.enviar();
    expect(navigate).toHaveBeenCalledWith('/#cotizador');
  });

  it.each(['https://example.invalid', '//example.invalid', '/\\example.invalid'])('no sigue destinos externos: %s', returnUrl => {
    route.snapshot.queryParamMap = convertToParamMap({ returnUrl });
    component.ingresarGoogle();
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('las pestañas cambian campos y validadores sin enviar el formulario', () => {
    const element: HTMLElement = fixture.nativeElement;
    (element.querySelectorAll('.modos button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element.querySelector('#acceso-nombre')).not.toBeNull();
    expect(element.querySelector('#acceso-telefono')).not.toBeNull();
    expect(element.querySelector('#acceso-contrasena')?.getAttribute('autocomplete')).toBe('new-password');
    component.cambiarModo('login');
    fixture.detectChanges();
    fillLogin();
    expect(component.formulario.valid).toBe(true);
    expect(element.querySelector('#acceso-nombre')).toBeNull();
    expect(auth.login).not.toHaveBeenCalled();
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('mostrar y ocultar contraseña no la cambia ni envía el formulario', () => {
    fillLogin();
    const element: HTMLElement = fixture.nativeElement;
    const toggle = element.querySelector('.ver-contrasena') as HTMLButtonElement;
    const password = element.querySelector('#acceso-contrasena') as HTMLInputElement;
    toggle.click();
    fixture.detectChanges();
    expect(password.type).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe('Ocultar contraseña');
    toggle.click();
    fixture.detectChanges();
    expect(password.type).toBe('password');
    expect(component.formulario.controls.contrasena.value).toBe('password-qa');
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('bloquea doble envío, cambio de modo y Google durante una petición', () => {
    const pending = new Subject<typeof session>();
    auth.login.mockReturnValue(pending);
    fillLogin();
    component.enviar();
    component.enviar();
    component.ingresarGoogle();
    component.cambiarModo('registro');
    fixture.detectChanges();
    expect(auth.login).toHaveBeenCalledOnce();
    expect(auth.loginGoogle).not.toHaveBeenCalled();
    expect(component.modo).toBe('login');
    expect((fixture.nativeElement.querySelector('.boton-principal') as HTMLButtonElement).disabled).toBe(true);
    pending.next(session);
    pending.complete();
    expect(component.cargando).toBe(false);
  });

  it('un rechazo de Google se muestra sin navegar ni fusionar cuentas', () => {
    auth.loginGoogle.mockReturnValue(throwError(() => ({ error: { message: 'Este correo ya tiene una cuenta local.' } })));
    component.ingresarGoogle();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('cuenta local');
    expect(component.cargando).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('mantiene el acceso local si Google está deshabilitado', async () => {
    auth.google.prepare.mockResolvedValue(false);
    component.ngOnInit();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.boton-google')).toBeNull();
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
  });
});
