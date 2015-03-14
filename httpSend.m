function y = httpSend(c)

    str = 'http://127.0.0.1:4334/send/1/1/RC_CHANNELS_OVERRIDE';
    str = [str '?target_system=' num2str(floor(1))];
    str = [str '&target_component=' num2str(floor(1))];
    str = [str '&chan1_raw=' num2str(floor(c(1)))];
    str = [str '&chan2_raw=' num2str(floor(c(2)))];
    str = [str '&chan3_raw=' num2str(floor(c(3)))];
    str = [str '&chan4_raw=' num2str(floor(c(4)))];
    str = [str '&chan5_raw=' num2str(floor(c(5)))];
    str = [str '&chan6_raw=' num2str(floor(c(6)))];
    str = [str '&chan7_raw=' num2str(floor(c(7)))];
    str = [str '&chan8_raw=' num2str(floor(c(8)))];
    urlread(str);
    y = 1;
end