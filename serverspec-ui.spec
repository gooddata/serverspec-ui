%global install_dir /opt/gdc/serverspec-ui

Name:             serverspec-ui
Summary:          GoodData ServerSpec integration UI
Version:          1.0
Release:          5{?dist}.gdc

Vendor:           GoodData
Group:            GoodData/Tools

License:          ISC
URL:              https://github.com/gooddata/serverspec-ui
Source0:          sources.tar
BuildArch:        noarch
BuildRoot:        %{_tmppath}/%{name}-%{version}-root

Requires:         serverspec-core
Requires:         npm(ansi-to-html)
Requires:         npm(handlebars)
Requires:         npm(javascript-natural-sort)
Requires:         npm(underscore)

%prep
%setup -q -c

%install
rm -fr ${RPM_BUILD_ROOT}
mkdir -p ${RPM_BUILD_ROOT}%{install_dir}
cp -a public index.handlebars package.json report.handlebars server.js README.md Makefile ${RPM_BUILD_ROOT}%{install_dir}
mkdir -p ${RPM_BUILD_ROOT}%{_initddir}
cp serverspec-ui.init ${RPM_BUILD_ROOT}%{_initddir}/serverspec-ui

%clean
rm -rf ${RPM_BUILD_ROOT}

%description
GoodData ServerSpec integration - UI package

%files
%attr(0755, root, root) %dir %{install_dir}
%attr(0755, root, root) %dir %{install_dir}/public
%attr(0755, root, root) %dir %{install_dir}/public/scripts
%attr(0755, root, root) %dir %{install_dir}/public/stylesheets
%attr(0644, root, root) %{install_dir}/public/scripts/report.js
%attr(0644, root, root) %{install_dir}/public/stylesheets/report.css
%attr(0644, root, root) %{install_dir}/index.handlebars
%attr(0644, root, root) %{install_dir}/package.json
%attr(0644, root, root) %{install_dir}/report.handlebars
%attr(0644, root, root) %{install_dir}/server.js
%attr(0644, root, root) %doc %{install_dir}/README.md
%attr(0755, root, root) %{_initddir}/serverspec-ui
%exclude %{install_dir}/Makefile


%changelog
* Mon Jun 29 2015 Radek Smidl <radek.smidl@gooddata.com> 1.0-5.gdc
- REPORTS_PATH renamed to REPORTS_DIR

* Mon Jun 29 2015 Radek Smidl <radek.smidl@gooddata.com> 1.0-4.gdc
- SPEC_DIR support added

* Mon Jun 29 2015 Radek Smidl <radek.smidl@gooddata.com> 1.0-3.gdc
- REPORTS_PATH added to init script

* Mon Jun 29 2015 Radek Smidl <radek.smidl@gooddata.com> 1.0-2.gdc
- NODE_PATH added to init script
- support for sysconfig added

* Fri Jun 26 2015 Radek Smidl <radek.smidl@gooddata.com> 1.0-1.gdc
- Initial rpmbuild
